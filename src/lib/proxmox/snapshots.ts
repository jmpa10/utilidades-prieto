import { comentario, q } from '../shell';
import { CABECERA_COMUN } from './common';
import { cabecera, describirObjetivo, variablesObjetivo, type Objetivo } from './objetivo';

/** Funciones bash para leer los snapshots de una máquina. */
export const BASH_SNAPSHOTS = String.raw`
# snapshots_de <tipo> <nodo> <vmid>: nombres de sus snapshots, uno por línea.
snapshots_de() {
  pvesh get "/nodes/$2/$1/$3/snapshot" --output-format json 2>/dev/null | python3 -c '
import json, sys
for s in json.load(sys.stdin):
    if s.get("name") != "current":
        print(s["name"])
' || true
}
`;

export interface OpcionesSnapshots extends Objetivo {
  nombre: string;
  descripcion: string;
  fecha?: Date;
}

export function scriptSnapshots(o: OpcionesSnapshots): string {
  return `${cabecera(
    'Snapshots de la clase',
    [`Alcance: ${describirObjetivo(o)}`, `Snapshot: ${comentario(o.nombre)}`],
    'bash snapshots.sh ver|crear|volver|borrar [--dry-run] [--yes]',
    o.fecha,
  )}
${variablesObjetivo(o)}
SNAP=${q(o.nombre)}
DESCRIPCION=${q(o.descripcion)}
${CABECERA_COMUN}${BASH_SNAPSHOTS}
comprobar_entorno

case "$ACCION" in
  ver|crear|volver|borrar) ;;
  *) fallo "Indica qué hacer: ver, crear, volver o borrar." ;;
esac

VMS=$(vms_objetivo "$OBJETIVO" "$FILTRO" "$ETIQUETA")
if [[ -z "$VMS" ]]; then
  aviso "No hay máquinas que coincidan."
  exit 0
fi

if [[ "$ACCION" == ver ]]; then
  titulo "Snapshots"
  while read -r tipo nodo id estado pool nombre; do
    lista=$(snapshots_de "$tipo" "$nodo" "$id" | paste -sd, - | sed 's/,/, /g')
    printf '  %-6s %-26s %-30s %s\\n' "$id" "$nombre" "$pool" "\${lista:--}"
  done <<<"$VMS"
  exit 0
fi

if [[ "$ACCION" == volver ]]; then
  titulo "Volver al snapshot $SNAP"
  aviso "Cada máquina perderá lo hecho desde ese snapshot (y se apagará si estaba encendida)."
  confirmar "$SNAP"
elif [[ "$ACCION" == borrar ]]; then
  titulo "Borrar el snapshot $SNAP"
  confirmar "$SNAP"
else
  titulo "Creando el snapshot $SNAP"
fi
(( DRY_RUN )) && aviso "Modo simulación: no se cambia nada."

HECHAS=0; SALTADAS=0
while read -r tipo nodo id estado pool nombre; do
  tiene=0
  lista=$(snapshots_de "$tipo" "$nodo" "$id")
  if grep -qxF -- "$SNAP" <<<"$lista"; then tiene=1; fi
  case "$ACCION" in
    crear)
      if (( tiene )); then info "$nombre ($id): ya tiene $SNAP"; SALTADAS=$((SALTADAS + 1)); continue; fi
      lanzar pvesh create "/nodes/$nodo/$tipo/$id/snapshot" --snapname "$SNAP" --description "$DESCRIPCION"
      ;;
    volver)
      if (( ! tiene )); then info "$nombre ($id): no tiene $SNAP"; SALTADAS=$((SALTADAS + 1)); continue; fi
      lanzar pvesh create "/nodes/$nodo/$tipo/$id/snapshot/$SNAP/rollback"
      ;;
    borrar)
      if (( ! tiene )); then SALTADAS=$((SALTADAS + 1)); continue; fi
      lanzar pvesh delete "/nodes/$nodo/$tipo/$id/snapshot/$SNAP"
      ;;
  esac
  ok "$nombre ($id) de $pool"
  HECHAS=$((HECHAS + 1))
done <<<"$VMS"
terminar_paralelo

titulo "Resumen"
ok "Máquinas: $HECHAS"
info "Saltadas: $SALTADAS"
`;
}
