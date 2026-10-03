/** «profe1, profe2@pve» → ['profe1@pve', 'profe2@pve']. */
export function listaProfesores(texto: string, realm: string): string[] {
  return [...new Set(texto.split(/[\s,;]+/).filter(Boolean).map((p) => (p.includes('@') ? p : `${p}@${realm}`)))];
}

export const profesorValido = (p: string) => /^[a-z0-9][a-z0-9._-]*@[a-z0-9_-]+$/i.test(p);
