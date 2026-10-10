import { comentario, fechaHora, q } from '../shell';
import { poolDe, usuarioCompleto } from '../names';

/** A qué máquinas se aplica una utilidad: una clase entera o algunos alumnos, con filtro opcional. */
export interface Objetivo {
  clase: string;
  /** Bases de usuario («jperez»). Vacío → toda la clase. */
  bases: string[];
  /** Solo máquinas cuyo nombre contenga este texto. */
  filtro: string;
  /** Solo máquinas con esta etiqueta de Proxmox. */
  etiqueta: string;
}

/** Pools a los que apunta: «asir2/» (toda la clase) o los pools de cada alumno. */
export function poolsObjetivo(o: Objetivo): string[] {
  return o.bases.length ? o.bases.map((b) => poolDe(b, o.clase)) : [`${o.clase}/`];
}

export function describirObjetivo(o: Objetivo): string {
  const quien = o.bases.length
    ? o.bases.length === 1
      ? `el alumno ${usuarioCompleto(o.bases[0], o.clase)}`
      : `${o.bases.length} alumnos de ${o.clase}`
    : `toda la clase ${o.clase}`;
  const filtros = [o.filtro && `nombre con «${o.filtro}»`, o.etiqueta && `etiqueta «${o.etiqueta}»`].filter(Boolean);
  return comentario(quien + (filtros.length ? `, máquinas con ${filtros.join(' y ')}` : ''));
}

/** Variables bash del objetivo. */
export function variablesObjetivo(o: Objetivo): string {
  return [
    `CLASE=${q(o.clase)}`,
    `OBJETIVO=${q(poolsObjetivo(o).join(','))}`,
    `FILTRO=${q(o.filtro)}`,
    `ETIQUETA=${q(o.etiqueta)}`,
  ].join('\n');
}

/** Cabecera de comentario común a los scripts. */
export function cabecera(titulo: string, lineas: string[], uso: string, fecha?: Date): string {
  return `#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
#  Utilidades Prieto · Proxmox · ${titulo}
#  Generado: ${fechaHora(fecha)}
${lineas.map((l) => `#  ${l}`).join('\n')}
#
#  Uso:  ${uso}
# ──────────────────────────────────────────────────────────────
set -euo pipefail
`;
}

/** Nombre de snapshot válido en Proxmox. */
export function validarSnapshot(nombre: string): string | null {
  if (!nombre) return 'Vacío';
  if (!/^[A-Za-z][A-Za-z0-9_-]*$/.test(nombre)) return 'Empieza por letra; solo letras, números, - y _';
  if (nombre.length > 40) return 'Máximo 40 caracteres';
  return null;
}
