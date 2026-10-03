import { comentario, fechaHora, q } from '../shell';
import { poolDe, usuarioCompleto } from '../names';
import { CABECERA_COMUN } from './common';

export interface AltaUsuario {
  base: string;
  nombre: string;
  password: string;
}

export interface OpcionesCreacion {
  /** Identificador normalizado de la clase («2asir»). Vacío → pool plano y sin grupo. */
  clase: string;
  /** Nombre legible de la clase («2º ASIR»). */
  claseNombre: string;
  realm: string;
  rol: string;
  cuotaGB: number | null;
  /** Storage de discos que se añade como miembro de cada pool (opcional). */
  storage: string;
  /** Storage de ISOs: la clase puede usarlas (Datastore.Audit) y los profesores subirlas. */
  storageIsos: string;
  /** Bridge Linux de la clase: solo su grupo puede conectar VMs a él (SDN.Use). */
  bridge: string;
  /** Pool común de plantillas que la clase puede clonar (PVETemplateUser). */
  poolPlantillas: string;
  /** Usuarios de Proxmox de los profesores de la clase («profe1@pve»). */
  profesores: string[];
  /** Roles de los profesores sobre el pool de la clase, separados por comas. */
  rolesProfesor: string;
  usuarios: AltaUsuario[];
  fecha?: Date;
}

export function scriptCreacion(o: OpcionesCreacion): string {
  const n = o.usuarios.length;
  const etiqueta = o.clase ? `${comentario(o.claseNombre) || o.clase} (${o.clase})` : 'sin clase';
  const altas = o.usuarios
    .map((u) => `alta ${q(usuarioCompleto(u.base, o.clase))} ${q(poolDe(u.base, o.clase))} ${q(u.nombre)} ${q(u.password)}`)
    .join('\n');

  return `#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
#  Utilidades Prieto · Proxmox · Crear usuarios y pools
#  Generado: ${fechaHora(o.fecha)}
#  Clase: ${etiqueta} · ${n} usuario${n === 1 ? '' : 's'} · rol ${comentario(o.rol)}${o.cuotaGB ? ` · cuota ${o.cuotaGB} GB` : ''}${o.clase && o.bridge ? `\n#  Red: ${comentario(o.bridge)}` : ''}${o.clase && o.profesores.length ? `\n#  Profesores: ${o.profesores.map(comentario).join(', ')}` : ''}
#
#  Uso:  bash crear-${o.clase || 'usuarios'}.sh [--dry-run]
#
#  ⚠  Contiene contraseñas en claro. Bórralo al terminar:
#       shred -u crear-${o.clase || 'usuarios'}.sh
# ──────────────────────────────────────────────────────────────
set -euo pipefail

REALM=${q(o.realm)}
ROL=${q(o.rol)}
CLASE=${q(o.clase)}
CLASE_NOMBRE=${q(o.claseNombre || o.clase)}
CUOTA_GB=${q(o.cuotaGB ? String(o.cuotaGB) : '')}
STORAGE=${q(o.storage)}
STORAGE_ISOS=${q(o.clase ? o.storageIsos : '')}
BRIDGE=${q(o.clase ? o.bridge : '')}
PLANTILLAS=${q(o.clase ? o.poolPlantillas : '')}
ROLES_PROFESOR=${q(o.rolesProfesor)}
PROFESORES=(${o.clase ? o.profesores.map(q).join(' ') : ''})
${CABECERA_COMUN}
comprobar_entorno

existe "$ROLES" "$ROL" || fallo "El rol '$ROL' no existe. Créalo antes en Centro de datos → Permisos → Roles."
if [[ -n "$CLASE" ]]; then
  version_minima 8 1 || fallo "Los pools anidados necesitan Proxmox VE 8.1 o superior."
fi
for st in "$STORAGE" "$STORAGE_ISOS"; do
  [[ -z "$st" ]] || pvesh get "/storage/$st" >/dev/null 2>&1 || fallo "El storage '$st' no existe."
done
if [[ -n "$BRIDGE" ]]; then
  existe "$ROLES" PVESDNUser || fallo "Falta el rol PVESDNUser: dar permiso sobre el bridge necesita Proxmox VE 8 o superior."
fi
if [[ -n "$PLANTILLAS" ]]; then
  existe "$ROLES" PVETemplateUser || fallo "Falta el rol PVETemplateUser."
fi
if (( \${#PROFESORES[@]} )); then
  IFS=, read -r -a roles_prof <<<"$ROLES_PROFESOR"
  for r in "\${roles_prof[@]}"; do
    existe "$ROLES" "$r" || fallo "El rol de profesor '$r' no existe."
  done
fi

titulo "Creando usuarios para $CLASE_NOMBRE"
(( DRY_RUN )) && aviso "Modo simulación: no se cambia nada."

# ── Clase: grupo + pool padre ─────────────────────────────────
if [[ -n "$CLASE" ]]; then
  if existe "$GRUPOS" "$CLASE"; then
    info "Grupo $CLASE ya existe"
  else
    run pveum group add "$CLASE" --comment "Clase $CLASE_NOMBRE"
    ok "Grupo $CLASE creado"
  fi
  if existe "$POOLS" "$CLASE"; then
    info "Pool $CLASE ya existe"
  else
    run pveum pool add "$CLASE" --comment "Clase $CLASE_NOMBRE"
    ok "Pool $CLASE creado"
  fi

  # Red: solo el grupo de la clase puede conectar VMs a su bridge.
  if [[ -n "$BRIDGE" ]]; then
    nodo=$(hostname)
    pvesh get "/nodes/$nodo/network/$BRIDGE" >/dev/null 2>&1 \
      || aviso "El bridge $BRIDGE no aparece en este nodo ($nodo). Revisa el nombre o créalo en todos los nodos."
    run pveum acl modify "/sdn/zones/localnetwork/$BRIDGE" --groups "$CLASE" --roles PVESDNUser
    ok "Grupo $CLASE puede usar el bridge $BRIDGE"
  fi

  # ISOs: la clase puede montarlas, pero no subir ni borrar.
  if [[ -n "$STORAGE_ISOS" ]]; then
    if ! existe "$ROLES" AlumnoISO; then
      run pveum role add AlumnoISO --privs Datastore.Audit
      ok "Rol AlumnoISO creado (solo lectura de ISOs)"
    fi
    run pveum acl modify "/storage/$STORAGE_ISOS" --groups "$CLASE" --roles AlumnoISO
    ok "Grupo $CLASE puede usar las ISOs de $STORAGE_ISOS"
  fi

  # Plantillas: la clase puede clonarlas en su propio pool.
  if [[ -n "$PLANTILLAS" ]]; then
    if ! existe "$POOLS" "$PLANTILLAS"; then
      run pveum pool add "$PLANTILLAS" --comment "Plantillas para clonar"
      ok "Pool $PLANTILLAS creado"
    fi
    run pveum acl modify "/pool/$PLANTILLAS" --groups "$CLASE" --roles PVETemplateUser
    ok "Grupo $CLASE puede clonar las plantillas de $PLANTILLAS"
  fi

  # Profesores: ven y gestionan todo el pool de la clase (se propaga a los alumnos).
  for prof in \${PROFESORES[@]+"\${PROFESORES[@]}"}; do
    if ! existe "$USERS" "$prof"; then
      aviso "El profesor $prof no existe en Proxmox: se salta."
      continue
    fi
    run pveum acl modify "/pool/$CLASE" --users "$prof" --roles "$ROLES_PROFESOR"
    if [[ -n "$STORAGE_ISOS" ]]; then
      run pveum acl modify "/storage/$STORAGE_ISOS" --users "$prof" --roles PVEDatastoreUser
    fi
    ok "Profesor $prof con acceso a la clase$([[ -n "$STORAGE_ISOS" ]] && echo " y a subir ISOs")"
  done
fi

CREADOS=0; EXISTENTES=0; ERRORES=0

# alta <usuario> <pool> <nombre> <contraseña>
alta() {
  local user="$1" pool="$2" nombre="$3" pass="$4"
  local userid="$user@$REALM"
  local comentario="$nombre"
  [[ -n "$CUOTA_GB" ]] && comentario="quota=\${CUOTA_GB}G; $nombre"

  printf '\\n%s▸ %s%s  %s\\n' "$C_B" "$userid" "$C_0" "$nombre"

  if existe "$POOLS" "$pool"; then
    info "pool $pool ya existe"
  else
    run pveum pool add "$pool" --comment "$comentario" || return 1
    if [[ -n "$STORAGE" ]]; then
      run pveum pool modify "$pool" --storage "$STORAGE" || aviso "no se pudo añadir $STORAGE al pool"
    fi
    ok "pool $pool"
  fi

  if existe "$USERS" "$userid"; then
    info "usuario ya existe (no se cambia su contraseña)"
    EXISTENTES=$((EXISTENTES + 1))
  else
    local grupo=()
    [[ -n "$CLASE" ]] && grupo=(--groups "$CLASE")
    if (( DRY_RUN )); then
      printf '  %s[simulación]%s pveum user add %s --password ******** %s --comment %q\\n' "$C_D" "$C_0" "$userid" "\${grupo[*]+\${grupo[*]}}" "$nombre"
    else
      pveum user add "$userid" --password "$pass" \${grupo[@]+"\${grupo[@]}"} --comment "$nombre" || return 1
    fi
    ok "usuario $userid"
    CREADOS=$((CREADOS + 1))
  fi

  run pveum acl modify "/pool/$pool" --users "$userid" --roles "$ROL" || return 1
  ok "rol $ROL sobre /pool/$pool"
}

intentar() {
  if ! alta "$@"; then
    error "falló el alta de $1"
    ERRORES=$((ERRORES + 1))
  fi
}

# ── Usuarios ──────────────────────────────────────────────────
alta_lote() {
${altas.replace(/^alta /gm, '  intentar ')}
}
alta_lote

titulo "Resumen"
ok "Creados: $CREADOS"
info "Ya existían: $EXISTENTES"
if (( ERRORES )); then
  error "Errores: $ERRORES"
  exit 1
fi
# Pegado desde la web ya se ha borrado solo; como fichero, hay que borrarlo a mano.
(( DRY_RUN )) || [[ "\${UP_AUTOBORRAR:-}" == 1 ]] || aviso "Recuerda borrar este script: contiene contraseñas."
`;
}
