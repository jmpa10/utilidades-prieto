import { comentario, fechaHora, q } from '../shell';
import { CABECERA_COMUN } from './common';
import { BASH_SNAPSHOTS } from './snapshots';
import { cabecera, describirObjetivo, variablesObjetivo, type Objetivo } from './objetivo';

export interface OpcionesRecoger extends Objetivo {
  /** Nombre corto de la práctica («practica3»). El snapshot será «entrega-practica3». */
  practica: string;
  fecha?: Date;
}

export const nombreEntrega = (practica: string) => `entrega-${practica}`;

export function scriptRecoger(o: OpcionesRecoger): string {
  const snap = nombreEntrega(o.practica);
  return `${cabecera(
    'Recoger prácticas',
    [`Alcance: ${describirObjetivo(o)}`, `Entrega: snapshot ${comentario(snap)} en cada máquina`],
    'bash recoger.sh [--dry-run]',
    o.fecha,
  )}
${variablesObjetivo(o)}
SNAP=${q(snap)}
DESCRIPCION=${q(`Entrega de ${o.practica} recogida el ${fechaHora(o.fecha)} con Utilidades Prieto`)}
${CABECERA_COMUN}${BASH_SNAPSHOTS}
comprobar_entorno

titulo "Recogiendo $SNAP"
(( DRY_RUN )) && aviso "Modo simulación: no se cambia nada."

VMS=$(vms_objetivo "$OBJETIVO" "$FILTRO" "$ETIQUETA")
RECOGIDAS=0; YA=0
CON_ENTREGA=""
while read -r tipo nodo id estado pool nombre; do
  [[ -n "$tipo" ]] || continue
  CON_ENTREGA+="$pool"$'\\n'
  lista=$(snapshots_de "$tipo" "$nodo" "$id")
  if grep -qxF -- "$SNAP" <<<"$lista"; then
    info "$nombre ($id) de $pool: ya recogida"
    YA=$((YA + 1))
    continue
  fi
  lanzar pvesh create "/nodes/$nodo/$tipo/$id/snapshot" --snapname "$SNAP" --description "$DESCRIPCION"
  ok "$nombre ($id) de $pool"
  RECOGIDAS=$((RECOGIDAS + 1))
done <<<"$VMS"
terminar_paralelo

titulo "Resumen"
ok "Recogidas ahora: $RECOGIDAS"
info "Ya estaban recogidas: $YA"
SIN=$(pools_objetivo "$OBJETIVO" | grep -vxF -f <(printf '%s' "$CON_ENTREGA" | sort -u) || true)
if [[ -n "$SIN" ]]; then
  aviso "Sin ninguna máquina que coincida (no han entregado):"
  sed 's/^/      /' <<<"$SIN"
fi
`;
}
