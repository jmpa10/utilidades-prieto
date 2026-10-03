import { CABECERA_COMUN } from './common';
import { cabecera, describirObjetivo, variablesObjetivo, type Objetivo } from './objetivo';

export function scriptLimpiar(o: Objetivo & { fecha?: Date }): string {
  if (!o.filtro && !o.etiqueta) throw new Error('Limpiar necesita un filtro por nombre o etiqueta');
  return `${cabecera(
    'Limpiar una práctica',
    [`Alcance: ${describirObjetivo(o)}`, '⚠  DESTRUYE las máquinas que coincidan, con sus discos.'],
    'bash limpiar.sh [--dry-run] [--yes]',
    o.fecha,
  )}
${variablesObjetivo(o)}
${CABECERA_COMUN}
comprobar_entorno

[[ -n "$FILTRO$ETIQUETA" ]] || fallo "Hace falta un filtro por nombre o etiqueta."

VMS=$(vms_objetivo "$OBJETIVO" "$FILTRO" "$ETIQUETA")
if [[ -z "$VMS" ]]; then
  aviso "No hay máquinas que coincidan."
  exit 0
fi

titulo "Se van a destruir"
while read -r tipo nodo id estado pool nombre; do
  printf '  • %-6s %-28s %-30s %s\\n' "$id" "$nombre" "$pool" "$estado"
done <<<"$VMS"
printf '\\n  %s%d máquina(s)%s\\n' "$C_B" "$(wc -l <<<"$VMS")" "$C_0"
confirmar "$CLASE"
(( DRY_RUN )) && aviso "Modo simulación: no se cambia nada."

titulo "Destruyendo"
while read -r tipo nodo id estado pool nombre; do
  lanzar destruir_vm "$tipo" "$nodo" "$id"
  ok "$nombre ($id)"
done <<<"$VMS"
terminar_paralelo
titulo "Hecho"
`;
}
