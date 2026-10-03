import { q } from '../shell';
import { CABECERA_COMUN } from './common';
import { cabecera, describirObjetivo, variablesObjetivo, type Objetivo } from './objetivo';

export interface OpcionesEnergia extends Objetivo {
  /** Segundos que espera a que se apague antes de forzar. */
  espera: number;
  fecha?: Date;
}

export function scriptEnergia(o: OpcionesEnergia): string {
  return `${cabecera(
    'Encender y apagar',
    [`Alcance: ${describirObjetivo(o)}`],
    'bash energia.sh ver|apagar|encender [--dry-run]',
    o.fecha,
  )}
${variablesObjetivo(o)}
ESPERA=${q(String(o.espera))}
${CABECERA_COMUN}
comprobar_entorno

case "$ACCION" in
  ver|apagar|encender) ;;
  *) fallo "Indica qué hacer: ver, apagar o encender." ;;
esac

VMS=$(vms_objetivo "$OBJETIVO" "$FILTRO" "$ETIQUETA")
if [[ -z "$VMS" ]]; then
  aviso "No hay máquinas que coincidan."
  exit 0
fi

titulo "$(case "$ACCION" in ver) echo "Máquinas";; apagar) echo "Apagando";; encender) echo "Encendiendo";; esac)"
(( DRY_RUN )) && aviso "Modo simulación: no se cambia nada."
HECHAS=0; SALTADAS=0
while read -r tipo nodo id estado pool nombre; do
  case "$ACCION" in
    ver)
      printf '  %-9s %-6s %-28s %s\\n' "$estado" "$id" "$nombre" "$pool"
      ;;
    apagar)
      if [[ "$estado" != running ]]; then SALTADAS=$((SALTADAS + 1)); continue; fi
      info "$nombre ($id) de $pool"
      lanzar pvesh create "/nodes/$nodo/$tipo/$id/status/shutdown" --timeout "$ESPERA" --forceStop 1
      HECHAS=$((HECHAS + 1))
      ;;
    encender)
      if [[ "$estado" == running ]]; then SALTADAS=$((SALTADAS + 1)); continue; fi
      info "$nombre ($id) de $pool"
      lanzar pvesh create "/nodes/$nodo/$tipo/$id/status/start"
      HECHAS=$((HECHAS + 1))
      ;;
  esac
done <<<"$VMS"

if [[ "$ACCION" == ver ]]; then
  printf '\\n  %d máquina(s), %d encendida(s)\\n' "$(wc -l <<<"$VMS")" "$(grep -c ' running ' <<<"$VMS" || true)"
  exit 0
fi
[[ "$ACCION" == apagar && HECHAS -gt 0 ]] && info "Esperando a que se apaguen (hasta $ESPERA s; después se fuerza)…"
terminar_paralelo
titulo "Resumen"
ok "$( [[ "$ACCION" == apagar ]] && echo Apagadas || echo Encendidas ): $HECHAS"
info "Ya estaban así: $SALTADAS"
`;
}
