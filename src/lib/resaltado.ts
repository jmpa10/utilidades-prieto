const ESCAPES: Record<string, string> = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export const escapar = (s: string) => s.replace(/[&<>"']/g, (c) => ESCAPES[c]);

const TOKENS =
  /(^[ \t]*#[^\n]*|\s#\s[^\n]*)|('[^']*'|"(?:\\.|[^"\\])*")|(\$\{[^}\n]*\}|\$[A-Za-z_][A-Za-z0-9_]*)|\b(if|then|elif|else|fi|for|in|do|done|case|esac|while|local|return|set|exit|continue)\b/gm;

/** Resaltado mínimo de bash: comentarios, cadenas, variables y palabras clave. Devuelve HTML escapado. */
export function resaltarBash(codigo: string): string {
  let html = '';
  let ultimo = 0;
  for (const m of codigo.matchAll(TOKENS)) {
    html += escapar(codigo.slice(ultimo, m.index));
    const clase = m[1] ? 'tk-com' : m[2] ? 'tk-str' : m[3] ? 'tk-var' : 'tk-key';
    html += `<span class="${clase}">${escapar(m[0])}</span>`;
    ultimo = m.index! + m[0].length;
  }
  return html + escapar(codigo.slice(ultimo));
}
