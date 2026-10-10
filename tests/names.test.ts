import { describe, expect, it } from 'vitest';
import { asignarBases, baseUsuario, claseId, parsearLinea, parsearTexto, poolDe, usuarioCompleto, validarIdentificador } from '../src/lib/names';

describe('parsearLinea', () => {
  it('lee «Apellidos, Nombre»', () => {
    expect(parsearLinea('Pérez García, Juan')).toEqual({ nombre: 'Juan', apellido1: 'Pérez', apellido2: 'García', apellidos: 'Pérez García', completo: 'Juan Pérez García' });
  });
  it('lee «Nombre Apellidos» si no hay coma', () => {
    expect(parsearLinea('Juan Pérez García')?.apellido1).toBe('Pérez');
  });
  it('ignora partículas en apellidos compuestos', () => {
    const p = parsearLinea('de la Fuente del Río, María José')!;
    expect(p.apellido1).toBe('Fuente');
    expect(p.apellido2).toBe('Río');
    expect(baseUsuario(p)).toBe('mfuente');
  });
  it('normaliza mayúsculas y espacios', () => {
    expect(parsearLinea('  NÚÑEZ   ibáñez ,  ÁLVARO ')?.completo).toBe('Álvaro Núñez Ibáñez');
  });
  it('pone mayúscula tras el guion', () => {
    expect(parsearLinea('FERNÁNDEZ-CANO ortiz, ana belén')!.completo).toBe('Ana Belén Fernández-Cano Ortiz');
  });
  it('descarta vacías y comentarios', () => {
    expect(parsearLinea('')).toBeNull();
    expect(parsearLinea('# lista 2º ASIR')).toBeNull();
  });
});

describe('usuarios', () => {
  it('quita tildes y eñes', () => {
    expect(baseUsuario(parsearLinea('Núñez Peña, Ángel')!)).toBe('anunez');
  });
  it('resuelve colisiones con el 2.º apellido y luego con números', () => {
    const personas = parsearTexto('Pérez García, Juan\nPérez Gómez, José\nPérez García, Jorge\nPérez López, Julia');
    expect(asignarBases(personas).map((b) => b.base)).toEqual(['jperez', 'jperezg', 'jperez2', 'jperezl']);
    expect(asignarBases(personas)[1].avisos).toHaveLength(1);
  });
  it('respeta nombres ocupados', () => {
    expect(asignarBases(parsearTexto('Pérez, Juan'), ['jperez'])[0].base).toBe('jperez2');
  });
  it('compone usuario y pool', () => {
    expect(claseId('2º ASIR')).toBe('asir2');
    expect(claseId('1º SMR B')).toBe('smrb1');
    expect(claseId('dam2')).toBe('dam2');
    expect(claseId('2026')).toBe('clase2026');
    expect(claseId('')).toBe('');
    expect(usuarioCompleto('jperez', 'asir2')).toBe('jperez-asir2');
    expect(poolDe('jperez', 'asir2')).toBe('asir2/jperez-asir2');
    expect(poolDe('jperez', '')).toBe('jperez');
  });
  it('valida identificadores', () => {
    expect(validarIdentificador('jperez-asir2')).toBeNull();
    expect(validarIdentificador('J Pérez')).not.toBeNull();
    expect(validarIdentificador('')).not.toBeNull();
  });
});
