import { fechaHora } from '../shell';
import { parsearLineaResumen, type LineaResumen } from '../names';

export interface OpcionesResumen {
  clase: string;
  claseNombre: string;
  realm: string;
  rol: string;
  cuotaGB: number | null;
  storage: string;
  urlProxmox: string;
  centro: string;
  usuarios: LineaResumen[];
  fecha?: Date;
}

/**
 * Resumen en texto plano para el profesor. Las líneas con # son comentarios; las de datos
 * las entiende la página de borrado («Desde el TXT») y también la de creación.
 */
export function resumenTxt(o: OpcionesResumen): string {
  const cab = ['Usuario', 'Pool', 'Contraseña', 'Alumno (Apellidos, Nombre)'];
  const filas = o.usuarios.map((u) => [u.userid, u.pool, u.password, u.nombre]);
  const anchos = cab.map((c, i) => Math.max(c.length, ...filas.map((f) => f[i].length)));
  const linea = (f: string[]) => f.map((c, i) => (i < f.length - 1 ? c.padEnd(anchos[i]) : c)).join('    ').trimEnd();

  return [
    `# Utilidades Prieto · Resumen de alta en Proxmox`,
    `# ${o.centro}`,
    `#`,
    `# Clase:          ${o.clase ? `${o.claseNombre || o.clase}` : 'sin clase'}`,
    `# Identificador:  ${o.clase || '-'}`,
    `# Generado:       ${fechaHora(o.fecha)}`,
    `# Usuarios:       ${o.usuarios.length}`,
    `# Rol:            ${o.rol}`,
    `# Cuota:          ${o.cuotaGB ? `${o.cuotaGB} GB por pool` : 'sin cuota'}`,
    `# Storage:        ${o.storage || '-'}`,
    ...(o.urlProxmox ? [`# Acceso:         ${o.urlProxmox}`] : []),
    `#`,
    `# ⚠ Contiene las contraseñas iniciales. Guárdalo en un sitio seguro.`,
    `#`,
    `# Para borrar estos usuarios más adelante: Utilidades Prieto → Proxmox →`,
    `# Borrar usuarios → «Desde el TXT» y carga este mismo fichero.`,
    `#`,
    `# ${linea(cab)}`,
    ...filas.map((f) => `  ${linea(f)}`),
    '',
  ].join('\n');
}

export interface ResumenLeido {
  clase: string;
  usuarios: LineaResumen[];
}

/** Lee un resumen. Devuelve null si el texto no tiene líneas de resumen. */
export function leerResumen(texto: string): ResumenLeido | null {
  const usuarios = texto.split(/\r?\n/).map(parsearLineaResumen).filter((u): u is LineaResumen => u !== null);
  if (!usuarios.length) return null;
  const clase = texto.match(/^#\s*Identificador:\s*([a-z0-9_-]+)\s*$/m)?.[1] ?? '';
  return { clase, usuarios };
}
