/** Entrecomilla un valor para bash con comillas simples (seguro ante $, !, `, " y '). */
export function q(valor: string): string {
  return `'${valor.replace(/'/g, `'\\''`)}'`;
}

/** Nombre de fichero seguro para descargas. */
export function nombreFichero(base: string): string {
  return base.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'script';
}

export function fechaHora(d = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
