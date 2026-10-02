import { describe, expect, it } from 'vitest';
import { aleatorio, generarPassword } from '../src/lib/passwords';
import { q } from '../src/lib/shell';
import { execFileSync } from 'node:child_process';

describe('contraseñas', () => {
  it('legibles con formato Animal-Adjetivo-NNN', () => {
    for (let i = 0; i < 50; i++) expect(generarPassword()).toMatch(/^[A-Z][a-z]+-[A-Z][a-z]+-\d{3}$/);
  });
  it('fuertes de 14 caracteres sin ambiguos', () => {
    const p = generarPassword('fuerte');
    expect(p).toHaveLength(14);
    expect(p).not.toMatch(/[0O1lI]/);
  });
  it('aleatorio dentro de rango', () => {
    for (let i = 0; i < 200; i++) expect(aleatorio(7)).toBeLessThan(7);
  });
});

describe('q (escapado bash)', () => {
  for (const valor of [`it's`, 'a$b`c`', 'hola!!', 'dos  espacios', `"x"\\n`, 'Pérez García']) {
    it(`conserva ${JSON.stringify(valor)}`, () => {
      const salida = execFileSync('bash', ['-c', `printf '%s' ${q(valor)}`], { encoding: 'utf8' });
      expect(salida).toBe(valor);
    });
  }
});
