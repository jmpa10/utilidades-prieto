export const DELIMITADOR = 'FIN_UTILIDADES_PRIETO';

/** Entrecomilla un argumento solo si hace falta. */
function arg(a: string): string {
  return /^[\w@.:/=+-]+$/.test(a) ? a : `'${a.replace(/'/g, `'\\''`)}'`;
}

export interface OpcionesPegar {
  args?: string[];
  /** El script se borra a sí mismo al arrancar (útil si lleva contraseñas). */
  autoborrar?: boolean;
}

/**
 * Convierte un script en un bloque que se pega tal cual en la terminal del nodo:
 *
 * 1. Desactiva la expansión de «!» y el historial, y borra del historial la propia línea
 *    pegada (con pegado entre corchetes, todo el bloque es una sola entrada).
 * 2. Vuelca el script en un fichero temporal (0600) con un heredoc literal.
 * 3. Lo ejecuta con bash en un proceso aparte: sus `exit` y `set -e` no cierran la sesión
 *    y su entrada sigue siendo el teclado (para las confirmaciones).
 * 4. Borra el fichero y restaura las opciones de la terminal.
 */
export function paraPegar(script: string, { args = [], autoborrar = false }: OpcionesPegar = {}): string {
  if (script.split('\n').includes(DELIMITADOR)) throw new Error(`El script contiene la línea ${DELIMITADOR}`);
  const argumentos = args.map(arg).join(' ');
  return [
    `set +H +o history; history -d -1 2>/dev/null; _up=$(mktemp "\${TMPDIR:-/tmp}/utilidades-prieto.XXXXXX")`,
    `cat > "$_up" <<'${DELIMITADOR}'`,
    // Sin «#!»: al pegar no hace falta y su «!» se expandiría como historial.
    script.replace(/^#!.*\n/, '').replace(/\n+$/, ''),
    DELIMITADOR,
    `${autoborrar ? 'UP_AUTOBORRAR=1 ' : ''}bash "$_up"${argumentos ? ` ${argumentos}` : ''}; rm -f "$_up"; unset _up; set -H -o history`,
    '',
  ].join('\n');
}
