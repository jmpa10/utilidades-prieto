/** Cadena HCL entre comillas dobles (segura ante \, ", saltos de línea y las plantillas ${ y %{). */
export function cadena(valor: string): string {
  const escapado = valor
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/([$%])\{/g, (_, c) => `${c}${c}{`);
  return `"${escapado}"`;
}

export function lista(valores: string[]): string {
  return `[${valores.map(cadena).join(', ')}]`;
}

/** Nombre válido para un recurso de Terraform: «debian-12» → «debian_12». */
export function identificador(texto: string): string {
  const id = texto.toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '');
  return /^[a-z_]/.test(id) ? id : `_${id}`;
}

/** Texto libre seguro para un comentario de una línea. */
export function comentarioHcl(texto: string): string {
  return texto.replace(/[\n\r\t]/g, ' ');
}

/** Pares «clave = valor» alineados como los deja terraform fmt. */
export function alinear(pares: [string, string][], sangria = ''): string {
  const ancho = Math.max(...pares.map(([k]) => k.length));
  return pares.map(([k, v]) => `${sangria}${k.padEnd(ancho)} = ${v}`).join('\n');
}
