import { describe, expect, it } from 'vitest';
import { formatoLista, parsearLinea, parsearTexto } from '../src/lib/names';
import { leerResumen, resumenTxt } from '../src/lib/proxmox/resumen';

const personas = parsearTexto('de la Fuente Ruiz, María José\nPérez García, Juan');
const resumen = resumenTxt({
  clase: '2asir',
  claseNombre: '2º ASIR',
  realm: 'pve',
  rol: 'Alumno',
  cuotaGB: 50,
  storage: 'local-lvm',
  urlProxmox: 'https://pve.centro.es:8006',
  centro: 'IES Gregorio Prieto',
  usuarios: [
    // Usuario editado a mano: no coincide con el que se calcularía del nombre.
    { userid: 'mjfuente-2asir@pve', pool: '2asir/mjfuente-2asir', password: 'Oso-Azul-222', nombre: formatoLista(personas[0]) },
    { userid: 'jperez-2asir@pve', pool: '2asir/jperez-2asir', password: 'Lince-Verde-472', nombre: formatoLista(personas[1]) },
  ],
  fecha: new Date('2026-10-02T10:00:00'),
});

describe('resumen TXT', () => {
  it('incluye cabecera, instrucciones y una línea por usuario', () => {
    expect(resumen).toMatch(/^# Identificador: +2asir$/m);
    expect(resumen).toContain('Borrar usuarios → «Desde el TXT»');
    expect(resumen).toMatch(/^ {2}mjfuente-2asir@pve\s{2,}2asir\/mjfuente-2asir\s{2,}Oso-Azul-222\s{2,}de la Fuente Ruiz, María José$/m);
  });

  it('se vuelve a leer con los usuarios exactos y la clase', () => {
    const leido = leerResumen(resumen)!;
    expect(leido.clase).toBe('2asir');
    expect(leido.usuarios.map((u) => u.userid)).toEqual(['mjfuente-2asir@pve', 'jperez-2asir@pve']);
    expect(leido.usuarios[0].password).toBe('Oso-Azul-222');
  });

  it('la página de creación entiende el resumen como lista de alumnos', () => {
    expect(parsearTexto(resumen).map((p) => p.completo)).toEqual(['María José de la Fuente Ruiz', 'Juan Pérez García']);
  });

  it('una lista normal no se confunde con un resumen', () => {
    expect(leerResumen('Pérez García, Juan\nNúñez, Ángel')).toBeNull();
    expect(parsearLinea('Pérez García, Juan')?.apellidos).toBe('Pérez García');
  });
});
