export interface Persona {
  nombre: string;
  apellido1: string;
  apellido2: string;
  /** Apellidos completos tal como venían: «de la Fuente Ruiz». */
  apellidos: string;
  /** Nombre para mostrar: «Juan Pérez García». */
  completo: string;
}

export interface Alumno extends Persona {
  /** Parte de usuario sin clase ni realm: «jperez». */
  base: string;
  password: string;
  avisos: string[];
}

const PARTICULAS = new Set(['de', 'del', 'la', 'las', 'los', 'y', 'da', 'das', 'do', 'dos', 'van', 'von', 'di', 'e', 'i']);

/** Minúsculas, sin tildes ni ñ y solo [a-z0-9]. */
export function slug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

/** «2º ASIR» → «2asir». */
export function claseId(texto: string): string {
  return slug(texto);
}

function palabras(texto: string): string[] {
  return texto.trim().split(/\s+/).filter(Boolean);
}

function capitalizar(texto: string): string {
  return palabras(texto)
    .map((p) => (PARTICULAS.has(p.toLowerCase()) ? p.toLowerCase() : p.charAt(0).toUpperCase() + p.slice(1).toLowerCase()))
    .join(' ');
}

/**
 * Admite «Apellidos, Nombre» (formato habitual de las plataformas educativas) y,
 * si no hay coma, «Nombre Apellido1 Apellido2».
 */
export function parsearLinea(linea: string): Persona | null {
  // Una línea del resumen TXT («usuario  pool  contraseña  Apellidos, Nombre»): se usa su nombre.
  const resumen = parsearLineaResumen(linea);
  if (resumen) linea = resumen.nombre;
  const limpia = linea.replace(/\s+/g, ' ').trim();
  if (!limpia || limpia.startsWith('#')) return null;

  let nombre: string;
  let apellidos: string;
  const coma = limpia.indexOf(',');
  if (coma >= 0) {
    apellidos = limpia.slice(0, coma).trim();
    nombre = limpia.slice(coma + 1).trim();
  } else {
    const [primero, ...resto] = palabras(limpia);
    nombre = primero;
    apellidos = resto.join(' ');
  }
  nombre = capitalizar(nombre);
  apellidos = capitalizar(apellidos);
  if (!nombre || !slug(nombre)) return null;

  const significativos = palabras(apellidos).filter((p) => !PARTICULAS.has(p.toLowerCase()) && slug(p));
  return {
    nombre,
    apellido1: significativos[0] ?? '',
    apellido2: significativos[1] ?? '',
    apellidos,
    completo: [nombre, apellidos].filter(Boolean).join(' '),
  };
}

export function parsearTexto(texto: string): Persona[] {
  return texto
    .split(/\r?\n/)
    .map(parsearLinea)
    .filter((p): p is Persona => p !== null);
}

/** Formato «Apellidos, Nombre» para volver a cargar la persona. */
export function formatoLista(p: Persona): string {
  return p.apellidos ? `${p.apellidos}, ${p.nombre}` : p.nombre;
}

export interface LineaResumen {
  userid: string;
  pool: string;
  password: string;
  nombre: string;
}

/** Línea de datos del resumen: columnas separadas por tabulador o por 2+ espacios. */
export function parsearLineaResumen(linea: string): LineaResumen | null {
  if (linea.trimStart().startsWith('#')) return null;
  const cols = linea.trim().split(/\t+| {2,}/);
  if (cols.length < 4 || !/^[a-z0-9][a-z0-9_-]*@[a-z0-9_-]+$/i.test(cols[0])) return null;
  return { userid: cols[0], pool: cols[1], password: cols[2], nombre: cols.slice(3).join(' ') };
}

/** «Juan», «Pérez» → «jperez». */
export function baseUsuario(p: Persona): string {
  return slug(p.nombre).charAt(0) + slug(p.apellido1);
}

/**
 * Asigna una base única a cada persona: jperez → jperezg (inicial del 2.º apellido) → jperez2…
 * `ocupados` permite reservar nombres ya existentes.
 */
export function asignarBases(personas: Persona[], ocupados: Iterable<string> = []): { base: string; avisos: string[] }[] {
  const usados = new Set(ocupados);
  return personas.map((p) => {
    const avisos: string[] = [];
    const base = baseUsuario(p);
    let candidato = base;
    if (usados.has(candidato)) {
      const inicial2 = slug(p.apellido2).charAt(0);
      candidato = inicial2 ? base + inicial2 : candidato;
      let n = 2;
      while (usados.has(candidato)) candidato = `${base}${n++}`;
      avisos.push(`Coincide con otro alumno: se usa «${candidato}»`);
    }
    if (!p.apellido1) avisos.push('Sin apellido: revisa el usuario');
    usados.add(candidato);
    return { base: candidato, avisos };
  });
}

/** Usuario de Proxmox sin realm: «jperez-2asir» (o «jperez» si no hay clase). */
export function usuarioCompleto(base: string, clase: string): string {
  return clase ? `${base}-${clase}` : base;
}

/** Pool del usuario: «2asir/jperez-2asir» (anidado) o «jperez» (plano). */
export function poolDe(base: string, clase: string): string {
  const user = usuarioCompleto(base, clase);
  return clase ? `${clase}/${user}` : user;
}

/** Valida una parte de identificador (usuario o pool) según las reglas de Proxmox. */
export function validarIdentificador(id: string): string | null {
  if (!id) return 'Vacío';
  if (!/^[a-z0-9][a-z0-9_-]*$/.test(id)) return 'Solo minúsculas, números, - y _';
  if (id.length > 60) return 'Máximo 60 caracteres';
  return null;
}
