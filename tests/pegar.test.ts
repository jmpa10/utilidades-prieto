import { afterAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, readdirSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { paraPegar, DELIMITADOR } from '../src/lib/pegar';
import { scriptCreacion, type OpcionesCreacion } from '../src/lib/proxmox/create';
import { scriptBorrado } from '../src/lib/proxmox/delete';
import { scriptAuditoria } from '../src/lib/proxmox/audit';
import { scriptPreparar } from '../src/lib/proxmox/preparar';
import { scriptEnergia } from '../src/lib/proxmox/energia';
import { scriptSnapshots } from '../src/lib/proxmox/snapshots';
import { scriptRecoger } from '../src/lib/proxmox/recoger';
import { scriptLimpiar } from '../src/lib/proxmox/limpiar';
import { scriptRepartir } from '../src/lib/proxmox/repartir';
import { scriptEstado } from '../src/lib/proxmox/estado';
import { scriptPassword } from '../src/lib/proxmox/password';
import { scriptProfesores } from '../src/lib/proxmox/profesores';
import { scriptMover } from '../src/lib/proxmox/mover';

const dir = mkdtempSync(join(tmpdir(), 'pegar-'));
const bin = join(dir, 'bin');
const tmp = join(dir, 'tmp');
mkdirSync(bin);
mkdirSync(tmp);
for (const c of ['pveum', 'pvesh', 'pveversion']) symlinkSync(resolve('tests/mock/pve.py'), join(bin, c));
const estado = join(dir, 'estado.json');
afterAll(() => rmSync(dir, { recursive: true, force: true }));

// Datos con todo lo que puede romper un pegado: apóstrofos, «!» y $.
const opciones: OpcionesCreacion = {
  clase: '1dart',
  claseNombre: `1º D'Art!x`,
  realm: 'pve',
  rol: 'Alumno',
  cuotaGB: 40,
  storage: 'local-lvm',
  storageIsos: 'local',
  bridge: 'vmbr1',
  poolPlantillas: '',
  profesores: [`o'neil!x@pve`],
  rolesProfesor: 'PVEVMAdmin',
  usuarios: [
    { base: 'aobrien', nombre: `Ana O'Brien!x`, password: `a!b'c$HOME` },
    { base: 'lruiz', nombre: 'Luis Ruiz', password: '!!ultimo' },
  ],
};

/**
 * Busca «!» que bash expandiría como historial al pegar todo el bloque de una vez
 * (pegado entre corchetes): fuera de comillas simples y seguido de algo que no sea
 * espacio, salto de línea, = o (.
 */
function exclamacionesPeligrosas(texto: string): string[] {
  const malas: string[] = [];
  let simple = false;
  let doble = false;
  for (let i = 0; i < texto.length; i++) {
    const c = texto[i];
    if (simple) {
      if (c === "'") simple = false;
      continue;
    }
    if (c === '\\') { i++; continue; }
    if (c === "'" && !doble) simple = true;
    else if (c === '"') doble = !doble;
    else if (c === '!') {
      const sig = texto[i + 1] ?? ' ';
      if (!' \t\n\r=('.includes(sig) && !(doble && sig === '"')) malas.push(texto.slice(Math.max(0, i - 30), i + 10));
    }
  }
  return malas;
}

const scripts = {
  creacion: scriptCreacion(opciones),
  borradoClase: scriptBorrado({ modo: 'clase', clase: '1dart', realm: 'pve', bases: [] }),
  borradoLista: scriptBorrado({ modo: 'lista', clase: '1dart', realm: 'pve', bases: ['aobrien'] }),
  auditoria: scriptAuditoria({ clase: '1dart', umbralAviso: 90 }),
  preparar: scriptPreparar({ rol: 'Alumno' }),
  energia: scriptEnergia({ clase: '1dart', bases: [], filtro: `d'a!x`, etiqueta: '', espera: 60 }),
  snapshots: scriptSnapshots({ clase: '1dart', bases: ['aobrien'], filtro: '', etiqueta: 'p1', nombre: 'antes-p1', descripcion: `Antes de l'examen!x` }),
  recoger: scriptRecoger({ clase: '1dart', bases: [], filtro: 'deb', etiqueta: '', practica: 'p1' }),
  limpiar: scriptLimpiar({ clase: '1dart', bases: [], filtro: 'deb', etiqueta: '' }),
  repartir: scriptRepartir({ clase: '1dart', bases: [], plantilla: `deb'!x`, prefijo: 'deb', storage: 'ssd-vms', encender: true }),
  estado: scriptEstado({ clase: '1dart', bases: [], filtro: '', etiqueta: '', realm: 'pve' }),
  password: scriptPassword({ usuarios: [{ userid: 'aobrien-1dart@pve', password: `a!b'c$HOME` }] }),
  profesores: scriptProfesores({ clase: '1dart', profesores: ['profe1@pve'], rolesProfesor: 'PVEVMAdmin', storageIsos: 'isos-hdd' }),
  mover: scriptMover({ realm: 'pve', rol: 'Alumno', claseOrigen: '1dart', baseOrigen: 'aobrien', claseDestino: '2dam', baseDestino: 'aobrien', password: `x!y'z` }),
};

describe('bloque para pegar', () => {
  for (const [nombre, script] of Object.entries(scripts)) {
    it(`${nombre}: sin «!» expandibles ni tabuladores`, () => {
      const bloque = paraPegar(script, { args: ['--dry-run'] });
      expect(exclamacionesPeligrosas(bloque)).toEqual([]);
      expect(bloque).not.toContain('\t');
      // «$VAR» seguido de un carácter no ASCII: bash podría leerlo como parte del nombre.
      const codigo = script.split('\n').filter((l) => !l.trimStart().startsWith('#')).join('\n');
      expect(codigo.match(/\$[A-Za-z_0-9][A-Za-z0-9_]*[^\x00-\x7F]/g)).toBeNull();
      expect(spawnSync('bash', ['-n'], { input: script }).status).toBe(0);
    });
  }

  it('rechaza un script que contenga el delimitador', () => {
    expect(() => paraPegar(`echo\n${DELIMITADOR}\n`)).toThrow();
  });

  /** Simula el pegado: una shell interactiva leyendo el bloque línea a línea. */
  function pegar(bloque: string) {
    const r = spawnSync('bash', ['--norc', '-i'], {
      input: bloque.replace('[[ $EUID -eq 0 ]]', 'true'),
      encoding: 'utf8',
      env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, PVE_STATE: estado, TMPDIR: tmp, PS1: '$ ', PS2: '> ' },
    });
    return r.stdout + r.stderr;
  }

  it('crea los usuarios al pegarlo, con contraseñas intactas, y no deja ficheros', () => {
    writeFileSync(estado, JSON.stringify({ version: '8.2.4', users: {}, groups: {}, pools: {}, roles: ['Alumno', 'PVESDNUser', 'PVEVMAdmin', 'PVEDatastoreUser'], acl: [], storages: ['local-lvm', 'local'], bridges: ['vmbr1'], vms: {} }));
    const salida = pegar(paraPegar(scripts.creacion, { autoborrar: true }));
    const s = JSON.parse(readFileSync(estado, 'utf8'));
    expect(s.users['aobrien-1dart@pve'], salida).toMatchObject({ password: `a!b'c$HOME`, comment: `Ana O'Brien!x` });
    expect(s.users['lruiz-1dart@pve'].password).toBe('!!ultimo');
    expect(salida).toContain('Creados: 2');
    expect(salida).not.toContain('Recuerda borrar');
    expect(readdirSync(tmp)).toEqual([]);
  });

  it('la simulación pegada no cambia nada', () => {
    writeFileSync(estado, JSON.stringify({ version: '8.2.4', users: {}, groups: {}, pools: {}, roles: ['Alumno', 'PVESDNUser', 'PVEVMAdmin', 'PVEDatastoreUser'], acl: [], storages: ['local-lvm', 'local'], bridges: ['vmbr1'], vms: {} }));
    const salida = pegar(paraPegar(scripts.creacion, { args: ['--dry-run'], autoborrar: true }));
    expect(salida).toContain('Modo simulación');
    expect(JSON.parse(readFileSync(estado, 'utf8')).users).toEqual({});
    expect(readdirSync(tmp)).toEqual([]);
  });

  it('un fallo dentro del script no cierra la terminal', () => {
    writeFileSync(estado, JSON.stringify({ version: '8.2.4', users: {}, groups: {}, pools: {}, roles: [], acl: [], storages: ['local-lvm', 'local'], bridges: ['vmbr1'], vms: {} }));
    const salida = pegar(paraPegar(scripts.creacion, { autoborrar: true }) + 'echo SIGUE_VIVA\n');
    expect(salida).toContain("El rol 'Alumno' no existe");
    expect(salida).toContain('SIGUE_VIVA');
  });
});
