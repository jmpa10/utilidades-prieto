import { comentario, q } from '../shell';
import { CABECERA_COMUN } from './common';
import { cabecera, describirObjetivo, variablesObjetivo, type Objetivo } from './objetivo';

export interface OpcionesRepartir {
  clase: string;
  bases: string[];
  /** VMID o nombre de la plantilla. */
  plantilla: string;
  /** Prefijo del nombre de cada clon: «debian» → «debian-jperez». */
  prefijo: string;
  /** Storage de destino de los discos (vacío: el de la plantilla). */
  storage: string;
  encender: boolean;
  fecha?: Date;
}

/** Prefijo válido para un nombre de máquina (DNS). */
export function validarPrefijo(p: string): string | null {
  if (!p) return 'Vacío';
  if (!/^[a-z0-9]([a-z0-9-]*[a-z0-9])?$/.test(p)) return 'Minúsculas, números y guiones (sin empezar ni acabar en guion)';
  if (p.length > 30) return 'Máximo 30 caracteres';
  return null;
}

export function scriptRepartir(o: OpcionesRepartir): string {
  const objetivo: Objetivo = { clase: o.clase, bases: o.bases, filtro: '', etiqueta: '' };
  return `${cabecera(
    'Repartir una plantilla',
    [`Alcance: ${describirObjetivo(objetivo)}`, `Plantilla: ${comentario(o.plantilla)} → ${comentario(o.prefijo)}-<alumno>`],
    'bash repartir.sh [--dry-run]',
    o.fecha,
  )}
${variablesObjetivo(objetivo)}
PLANTILLA=${q(o.plantilla)}
PREFIJO=${q(o.prefijo)}
STORAGE=${q(o.storage)}
ENCENDER=${o.encender ? 1 : 0}
${CABECERA_COMUN}
comprobar_entorno

# Busca la plantilla por VMID o por nombre.
read -r T_TIPO T_NODO T_ID T_NOMBRE < <(pvesh get /cluster/resources --type vm --output-format json | python3 -c '
import json, sys
buscada = sys.argv[1]
encontradas = [r for r in json.load(sys.stdin) if r.get("template") and buscada in (str(r.get("vmid")), r.get("name"))]
if len(encontradas) == 1:
    r = encontradas[0]
    print(r["type"], r["node"], r["vmid"], r.get("name") or "-")
elif len(encontradas) > 1:
    print("VARIAS")
' "$PLANTILLA") || true
[[ -n "\${T_TIPO:-}" ]] || fallo "No hay ninguna plantilla con VMID o nombre «\${PLANTILLA}»."
[[ "$T_TIPO" != VARIAS ]] || fallo "Hay varias plantillas llamadas «\${PLANTILLA}»: usa su VMID."
if [[ -n "$STORAGE" ]]; then
  pvesh get "/storage/$STORAGE" >/dev/null 2>&1 || fallo "El storage '$STORAGE' no existe."
fi
[[ "$T_TIPO" == lxc ]] && CAMPO_NOMBRE=hostname || CAMPO_NOMBRE=name

ALUMNOS=$(pools_objetivo "$OBJETIVO" | grep -vxF -- "$CLASE" | sort || true)
[[ -n "$ALUMNOS" ]] || fallo "No hay pools de alumno en $CLASE."
EXISTENTES=$(vms_objetivo "$OBJETIVO" "" "")

titulo "Repartiendo $T_NOMBRE ($T_ID) a $(wc -l <<<"$ALUMNOS" | tr -d ' ') alumno(s)"
(( DRY_RUN )) && aviso "Modo simulación: no se cambia nada."
CREADAS=0; YA=0; ERRORES=0
while read -r pool; do
  user="\${pool#*/}"
  base="\${user%-"$CLASE"}"
  nombre="$PREFIJO-$base"
  if awk -v p="$pool" -v n="$nombre" '$5 == p && $6 == n { e = 1 } END { exit !e }' <<<"$EXISTENTES"; then
    info "$pool: ya tiene $nombre"
    YA=$((YA + 1))
    continue
  fi
  # Los clones van de uno en uno: cada uno necesita el siguiente VMID libre.
  id=$(pvesh get /cluster/nextid)
  destino=()
  [[ -n "$STORAGE" ]] && destino=(--storage "$STORAGE")
  if run pvesh create "/nodes/$T_NODO/$T_TIPO/$T_ID/clone" --newid "$id" --"$CAMPO_NOMBRE" "$nombre" \\
      --pool "$pool" --full 1 --target "$T_NODO" \${destino[@]+"\${destino[@]}"}; then
    ok "$pool: $nombre ($id)"
    CREADAS=$((CREADAS + 1))
    if (( ENCENDER )); then
      run pvesh create "/nodes/$T_NODO/$T_TIPO/$id/status/start" || aviso "no se pudo encender $nombre"
    fi
  else
    error "$pool: falló el clon de $nombre"
    ERRORES=$((ERRORES + 1))
  fi
done <<<"$ALUMNOS"

titulo "Resumen"
ok "Clones creados: $CREADAS"
info "Ya la tenían: $YA"
if (( ERRORES )); then
  error "Errores: $ERRORES"
  exit 1
fi
`;
}
