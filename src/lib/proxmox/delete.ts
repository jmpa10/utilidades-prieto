import { fechaHora, q } from '../shell';
import { poolDe, usuarioCompleto } from '../names';
import { CABECERA_COMUN } from './common';

export type ModoBorrado = 'clase' | 'lista' | 'usuario';

export interface OpcionesBorrado {
  modo: ModoBorrado;
  /** Clase normalizada («2asir»). En modo usuario puede ir vacía (pool plano). */
  clase: string;
  realm: string;
  /** Bases de usuario («jperez») para los modos lista y usuario. */
  bases: string[];
  fecha?: Date;
}

export function scriptBorrado(o: OpcionesBorrado): string {
  const nombre = `borrar-${o.clase || o.bases[0] || 'usuarios'}`;
  const confirmacion = o.modo === 'usuario' ? usuarioCompleto(o.bases[0] ?? '', o.clase) : o.clase;
  const descripcion =
    o.modo === 'clase'
      ? `toda la clase ${o.clase}`
      : o.modo === 'lista'
        ? `${o.bases.length} usuarios de ${o.clase}`
        : `el usuario ${confirmacion}@${o.realm}`;
  const objetivos = o.bases
    .map((b) => `  ${q(usuarioCompleto(b, o.clase))} ${q(poolDe(b, o.clase))}`)
    .join('\n');

  const descubrir =
    o.modo === 'clase'
      ? String.raw`# Descubre en el momento todos los subpools «$CLASE/…» y usuarios «…-$CLASE@$REALM».
VISTOS=""
while IFS= read -r pool; do
  [[ "$pool" == "$CLASE/"* ]] || continue
  user="\${pool#"$CLASE/"}"
  OBJETIVOS+=("$user" "$pool"); VISTOS+="$user"$'\n'
done <<<"$POOLS"
while IFS= read -r userid; do
  [[ "$userid" == *"-$CLASE@$REALM" ]] || continue
  user="\${userid%@*}"
  existe "$VISTOS" "$user" && continue
  OBJETIVOS+=("$user" "$CLASE/$user")
done <<<"$USERS"`.replace(/\\\$/g, '$')
      : `OBJETIVOS=(\n${objetivos}\n)`;

  return `#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
#  Utilidades Prieto · Proxmox · Borrar usuarios y pools
#  Generado: ${fechaHora(o.fecha)}
#  Alcance: ${descripcion}
#
#  ⚠  DESTRUYE las VMs y contenedores de cada pool, el pool y el usuario.
#
#  Uso:  bash ${nombre}.sh [--dry-run] [--yes]
# ──────────────────────────────────────────────────────────────
set -euo pipefail

REALM=${q(o.realm)}
CLASE=${q(o.clase)}
MODO=${q(o.modo)}
CONFIRMACION=${q(confirmacion)}
${CABECERA_COMUN}
comprobar_entorno

# Pares «usuario pool»
OBJETIVOS=()
${descubrir}

if (( \${#OBJETIVOS[@]} == 0 )); then
  aviso "No hay nada que borrar."
  exit 0
fi

# ── Inventario ────────────────────────────────────────────────
titulo "Se va a borrar"
TOTAL_VMS=0
for ((i = 0; i < \${#OBJETIVOS[@]}; i += 2)); do
  user="\${OBJETIVOS[i]}"; pool="\${OBJETIVOS[i+1]}"
  vms=$(existe "$POOLS" "$pool" && miembros "$pool" | grep -cv '^storage' || true)
  vms=\${vms:-0}
  TOTAL_VMS=$((TOTAL_VMS + vms))
  estado=""
  existe "$USERS" "$user@$REALM" || estado+=" (sin usuario)"
  existe "$POOLS" "$pool" || estado+=" (sin pool)"
  printf '  • %-28s %-36s %s VM/CT%s\\n' "$user@$REALM" "$pool" "$vms" "$estado"
done
printf '\\n  %s%d usuario(s) · %d VM/CT que se destruirán%s\\n' "$C_B" $((\${#OBJETIVOS[@]} / 2)) "$TOTAL_VMS" "$C_0"

if (( DRY_RUN )); then
  aviso "Modo simulación: no se cambia nada."
elif (( ! SI_A_TODO )); then
  [[ -t 0 ]] || fallo "Sin terminal para confirmar: ejecuta con --yes si estás seguro."
  printf '\\n%sEsta acción no se puede deshacer.%s Escribe «%s» para continuar: ' "$C_E" "$C_0" "$CONFIRMACION"
  read -r respuesta
  [[ "$respuesta" == "$CONFIRMACION" ]] || fallo "Cancelado."
fi

BORRADOS=0; ERRORES=0

# destruir_pool <pool>: para y destruye sus VMs/CTs y quita los storages.
destruir_pool() {
  local pool="$1" tipo nodo id
  while read -r tipo nodo id; do
    [[ -n "$tipo" ]] || continue
    if [[ "$tipo" == storage ]]; then
      run pveum pool modify "$pool" --storage "$id" --delete 1 || return 1
      continue
    fi
    info "$tipo $id en $nodo: parando y destruyendo"
    run pvesh create "/nodes/$nodo/$tipo/$id/status/stop" || true
    if [[ "$tipo" == qemu ]]; then
      run pvesh delete "/nodes/$nodo/qemu/$id" --purge 1 --destroy-unreferenced-disks 1 || return 1
    else
      run pvesh delete "/nodes/$nodo/lxc/$id" --purge 1 --destroy-unreferenced-disks 1 || return 1
    fi
  done < <(miembros "$pool")
}

baja() {
  local user="$1" pool="$2"
  printf '\\n%s▸ %s%s\\n' "$C_B" "$user@$REALM" "$C_0"
  if existe "$POOLS" "$pool"; then
    destruir_pool "$pool" || return 1
    run pveum pool delete "$pool" || return 1
    ok "pool $pool borrado"
  fi
  if existe "$USERS" "$user@$REALM"; then
    run pveum user delete "$user@$REALM" || return 1
    ok "usuario $user@$REALM borrado"
  fi
}

titulo "Borrando"
for ((i = 0; i < \${#OBJETIVOS[@]}; i += 2)); do
  if baja "\${OBJETIVOS[i]}" "\${OBJETIVOS[i+1]}"; then
    BORRADOS=$((BORRADOS + 1))
  else
    error "falló el borrado de \${OBJETIVOS[i]}"
    ERRORES=$((ERRORES + 1))
  fi
done

# En modo clase, borra también el pool padre y el grupo si se han quedado vacíos.
if [[ "$MODO" == clase && -n "$CLASE" ]] && (( ! DRY_RUN )); then
  cargar_estado
  if existe "$POOLS" "$CLASE" && ! grep -q "^$CLASE/" <<<"$POOLS" && [[ -z "$(miembros "$CLASE")" ]]; then
    pveum pool delete "$CLASE" && ok "pool de clase $CLASE borrado"
  fi
  if existe "$GRUPOS" "$CLASE"; then
    miembros_grupo=$(pvesh get "/access/groups/$CLASE" --output-format json | python3 -c 'import json,sys; print(len(json.load(sys.stdin).get("members", [])))')
    if [[ "$miembros_grupo" == 0 ]]; then
      pveum group delete "$CLASE" && ok "grupo $CLASE borrado"
    else
      aviso "El grupo $CLASE aún tiene $miembros_grupo miembro(s): no se borra."
    fi
  fi
fi

titulo "Resumen"
ok "Borrados: $BORRADOS"
if (( ERRORES )); then
  error "Errores: $ERRORES"
  exit 1
fi
`;
}
