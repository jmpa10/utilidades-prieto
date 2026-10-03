import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { scriptEnergia } from '../src/lib/proxmox/energia';
import { scriptSnapshots } from '../src/lib/proxmox/snapshots';
import { scriptRecoger } from '../src/lib/proxmox/recoger';
import { scriptLimpiar } from '../src/lib/proxmox/limpiar';
import { scriptRepartir } from '../src/lib/proxmox/repartir';
import { scriptEstado } from '../src/lib/proxmox/estado';
import { scriptPassword } from '../src/lib/proxmox/password';
import { scriptProfesores } from '../src/lib/proxmox/profesores';
import { scriptMover } from '../src/lib/proxmox/mover';
import type { Objetivo } from '../src/lib/proxmox/objetivo';

const dir = mkdtempSync(join(tmpdir(), 'aula-'));
const bin = join(dir, 'bin');
mkdirSync(bin);
for (const c of ['pveum', 'pvesh', 'pveversion']) symlinkSync(resolve('tests/mock/pve.py'), join(bin, c));
const estado = join(dir, 'estado.json');
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const leer = () => JSON.parse(readFileSync(estado, 'utf8'));
function ejecutar(script: string, args: string[] = []) {
  const fichero = join(dir, 'script.sh');
  writeFileSync(fichero, script.replace('[[ $EUID -eq 0 ]]', 'true'));
  const r = spawnSync('bash', [fichero, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, PVE_STATE: estado },
  });
  return { codigo: r.status, salida: r.stdout + r.stderr };
}

const usuario = (comment: string) => ({ groups: ['2asir'], comment, password: 'vieja' });
const ESCENARIO = () => ({
  version: '8.2.4',
  roles: ['Alumno', 'PVEVMAdmin', 'PVEPoolUser', 'PVEDatastoreUser'],
  storages: ['ssd-vms', 'isos-hdd'],
  groups: { '2asir': {}, '2dam': {} },
  users: {
    'jperez-2asir@pve': usuario('Juan Pérez'),
    'mfuente-2asir@pve': usuario('María Fuente'),
    'anunez-2asir@pve': usuario('Ángel Núñez'),
    'profe1@pve': { groups: [], comment: 'Profe', password: 'x' },
  },
  pools: {
    '2asir': { comment: 'Clase 2º ASIR', storage: [] },
    '2asir/jperez-2asir': { comment: 'quota=50G; Juan Pérez', storage: ['ssd-vms'] },
    '2asir/mfuente-2asir': { comment: 'quota=50G; María Fuente', storage: ['ssd-vms'] },
    '2asir/anunez-2asir': { comment: 'quota=50G; Ángel Núñez', storage: ['ssd-vms'] },
    '2dam': { comment: 'Clase 2º DAM', storage: [] },
    '2dam/otro-2dam': { comment: '', storage: [] },
    plantillas: { comment: '', storage: [] },
  },
  acl: [],
  vms: {
    'qemu/100': { node: 'pve1', pool: '2asir/jperez-2asir', name: 'debian-jperez', status: 'running', tags: 'practica3', config: {} },
    'qemu/101': { node: 'pve2', pool: '2asir/jperez-2asir', name: 'web-jperez', status: 'stopped', config: {} },
    'lxc/102': { node: 'pve1', pool: '2asir/mfuente-2asir', name: 'debian-mfuente', status: 'running', config: {} },
    'qemu/200': { node: 'pve1', pool: 'plantillas', name: 'debian-base', template: true, status: 'stopped', config: {} },
    'qemu/300': { node: 'pve1', pool: '2dam/otro-2dam', name: 'debian-otro', status: 'running', config: {} },
  },
});
beforeEach(() => writeFileSync(estado, JSON.stringify(ESCENARIO())));

const clase: Objetivo = { clase: '2asir', bases: [], filtro: '', etiqueta: '' };
const estadoDe = (id: string) => leer().vms[id]?.status;

describe('encender y apagar', () => {
  it('apaga solo las de la clase y salta las ya apagadas', () => {
    const r = ejecutar(scriptEnergia({ ...clase, espera: 60 }), ['apagar']);
    expect(r.codigo, r.salida).toBe(0);
    expect([estadoDe('qemu/100'), estadoDe('lxc/102'), estadoDe('qemu/300')]).toEqual(['stopped', 'stopped', 'running']);
    expect(r.salida).toContain('Apagadas: 2');
    expect(r.salida).toContain('Ya estaban así: 1');
  });

  it('enciende las de un alumno concreto', () => {
    const r = ejecutar(scriptEnergia({ ...clase, bases: ['jperez'], espera: 60 }), ['encender']);
    expect(r.codigo, r.salida).toBe(0);
    expect(estadoDe('qemu/101')).toBe('running');
    expect(r.salida).toContain('Encendidas: 1');
  });

  it('«ver» lista sin cambiar nada y exige una acción', () => {
    const r = ejecutar(scriptEnergia({ ...clase, espera: 60 }), ['ver']);
    expect(r.salida).toContain('3 máquina(s), 2 encendida(s)');
    expect(ejecutar(scriptEnergia({ ...clase, espera: 60 })).codigo).toBe(1);
  });
});

describe('snapshots', () => {
  const opc = { ...clase, filtro: 'debian', nombre: 'antes-p3', descripcion: 'Antes de la práctica 3' };
  it('crea, lista, vuelve y borra', () => {
    let r = ejecutar(scriptSnapshots(opc), ['crear']);
    expect(r.codigo, r.salida).toBe(0);
    expect(Object.keys(leer().vms['qemu/100'].snapshots)).toEqual(['antes-p3']);
    expect(leer().vms['qemu/101'].snapshots).toBeUndefined();

    r = ejecutar(scriptSnapshots(opc), ['crear']);
    expect(r.salida).toContain('Saltadas: 2');

    r = ejecutar(scriptSnapshots(opc), ['ver']);
    expect(r.salida).toMatch(/100\s+debian-jperez\s+2asir\/jperez-2asir\s+antes-p3/);

    expect(ejecutar(scriptSnapshots(opc), ['volver']).codigo).toBe(1);
    r = ejecutar(scriptSnapshots(opc), ['volver', '--yes']);
    expect(r.codigo, r.salida).toBe(0);
    expect(leer().vms['lxc/102'].restaurada_a).toBe('antes-p3');

    r = ejecutar(scriptSnapshots(opc), ['borrar', '--yes']);
    expect(r.codigo, r.salida).toBe(0);
    expect(leer().vms['qemu/100'].snapshots).toEqual({});
  });
});

describe('recoger prácticas', () => {
  it('hace el snapshot de entrega e informa de quién no ha entregado', () => {
    const opc = { ...clase, filtro: 'debian', practica: 'practica3' };
    let r = ejecutar(scriptRecoger(opc));
    expect(r.codigo, r.salida).toBe(0);
    expect(Object.keys(leer().vms['qemu/100'].snapshots)).toEqual(['entrega-practica3']);
    expect(Object.keys(leer().vms['lxc/102'].snapshots)).toEqual(['entrega-practica3']);
    expect(r.salida).toContain('Recogidas ahora: 2');
    expect(r.salida).toMatch(/no han entregado[\s\S]*2asir\/anunez-2asir/);
    expect(r.salida).not.toMatch(/no han entregado[\s\S]*jperez/);

    r = ejecutar(scriptRecoger(opc));
    expect(r.salida).toContain('Ya estaban recogidas: 2');
  });

  it('filtra por etiqueta', () => {
    const r = ejecutar(scriptRecoger({ ...clase, etiqueta: 'practica3', practica: 'p3' }));
    expect(r.salida).toContain('Recogidas ahora: 1');
  });
});

describe('limpiar una práctica', () => {
  it('destruye solo lo filtrado tras confirmar', () => {
    expect(ejecutar(scriptLimpiar({ ...clase, filtro: 'web' })).codigo).toBe(1);
    const r = ejecutar(scriptLimpiar({ ...clase, filtro: 'web' }), ['--yes']);
    expect(r.codigo, r.salida).toBe(0);
    expect(Object.keys(leer().vms)).toEqual(['qemu/100', 'lxc/102', 'qemu/200', 'qemu/300']);
  });

  it('exige un filtro', () => {
    expect(() => scriptLimpiar(clase)).toThrow();
  });
});

describe('repartir una plantilla', () => {
  const opc = { clase: '2asir', bases: [], plantilla: 'debian-base', prefijo: 'deb', storage: 'ssd-vms', encender: false };
  it('clona la plantilla en el pool de cada alumno con el siguiente VMID libre', () => {
    const r = ejecutar(scriptRepartir(opc));
    expect(r.codigo, r.salida).toBe(0);
    const vms = leer().vms;
    expect(vms['qemu/103']).toMatchObject({ name: 'deb-anunez', pool: '2asir/anunez-2asir', clonada_de: '200', storage: 'ssd-vms' });
    expect(vms['qemu/104']).toMatchObject({ name: 'deb-jperez', pool: '2asir/jperez-2asir' });
    expect(vms['qemu/105']).toMatchObject({ name: 'deb-mfuente', pool: '2asir/mfuente-2asir' });
    expect(r.salida).toContain('Clones creados: 3');

    const otra = ejecutar(scriptRepartir(opc));
    expect(otra.salida).toContain('Clones creados: 0');
    expect(Object.keys(leer().vms)).toHaveLength(8);
  });

  it('acepta el VMID, alumnos concretos y encender', () => {
    const r = ejecutar(scriptRepartir({ ...opc, plantilla: '200', bases: ['mfuente'], encender: true }));
    expect(r.codigo, r.salida).toBe(0);
    expect(leer().vms['qemu/103']).toMatchObject({ name: 'deb-mfuente', status: 'running' });
  });

  it('falla si la plantilla no existe', () => {
    const r = ejecutar(scriptRepartir({ ...opc, plantilla: 'nada' }));
    expect(r.codigo).toBe(1);
    expect(r.salida).toContain('No hay ninguna plantilla');
  });
});

describe('estado de la clase', () => {
  it('resume por alumno y señala a quien no tiene máquinas', () => {
    const r = ejecutar(scriptEstado({ ...clase, realm: 'pve' }));
    expect(r.codigo, r.salida).toBe(0);
    expect(r.salida).toMatch(/jperez-2asir\s+2\s+1\s+2\.0G\s+2\s+64\/50\s+debian-jperez\*, web-jperez/);
    expect(r.salida).toContain('3 alumno(s) · 3 máquina(s) · 2 encendida(s)');
    expect(r.salida).toContain('Sin ninguna máquina: anunez-2asir');
    expect(r.salida).not.toContain('otro-2dam');
  });
});

describe('contraseñas', () => {
  const opc = { usuarios: [{ userid: 'jperez-2asir@pve', password: 'Nueva-1' }, { userid: 'nadie@pve', password: 'x' }] };
  it('cambia las que existen y avisa de las que no', () => {
    const r = ejecutar(scriptPassword(opc));
    expect(r.codigo).toBe(1);
    expect(leer().users['jperez-2asir@pve'].password).toBe('Nueva-1');
    expect(r.salida).toContain('nadie@pve no existe');
  });
  it('--dry-run no cambia ni muestra contraseñas', () => {
    const r = ejecutar(scriptPassword(opc), ['--dry-run']);
    expect(leer().users['jperez-2asir@pve'].password).toBe('vieja');
    expect(r.salida).not.toContain('Nueva-1');
  });
});

describe('profesores de una clase', () => {
  const opc = { clase: '2asir', profesores: ['profe1@pve'], rolesProfesor: 'PVEVMAdmin,PVEPoolUser', storageIsos: 'isos-hdd' };
  it('añade y quita', () => {
    let r = ejecutar(scriptProfesores(opc), ['anadir']);
    expect(r.codigo, r.salida).toBe(0);
    expect(leer().acl).toEqual([
      ['/pool/2asir', 'user', 'profe1@pve', 'PVEVMAdmin'],
      ['/pool/2asir', 'user', 'profe1@pve', 'PVEPoolUser'],
      ['/storage/isos-hdd', 'user', 'profe1@pve', 'PVEDatastoreUser'],
    ]);
    r = ejecutar(scriptProfesores(opc), ['quitar']);
    expect(r.codigo, r.salida).toBe(0);
    expect(leer().acl).toEqual([['/storage/isos-hdd', 'user', 'profe1@pve', 'PVEDatastoreUser']]);
  });
});

describe('mover alumno de clase', () => {
  const opc = { realm: 'pve', rol: 'Alumno', claseOrigen: '2asir', baseOrigen: 'jperez', claseDestino: '2dam', baseDestino: 'jperez', password: 'Nueva-2' };
  it('crea el usuario nuevo con sus máquinas y borra el antiguo', () => {
    const r = ejecutar(scriptMover(opc));
    expect(r.codigo, r.salida).toBe(0);
    const s = leer();
    expect(s.users['jperez-2dam@pve']).toEqual({ groups: ['2dam'], comment: 'Juan Pérez', password: 'Nueva-2' });
    expect(s.users['jperez-2asir@pve']).toBeUndefined();
    expect(s.pools['2dam/jperez-2dam']).toEqual({ comment: 'quota=50G; Juan Pérez', storage: ['ssd-vms'] });
    expect(s.pools['2asir/jperez-2asir']).toBeUndefined();
    expect([s.vms['qemu/100'].pool, s.vms['qemu/101'].pool]).toEqual(['2dam/jperez-2dam', '2dam/jperez-2dam']);
    expect(s.acl).toContainEqual(['/pool/2dam/jperez-2dam', 'user', 'jperez-2dam@pve', 'Alumno']);
  });

  it('se niega si la clase destino no existe', () => {
    const r = ejecutar(scriptMover({ ...opc, claseDestino: '1smr' }));
    expect(r.codigo).toBe(1);
    expect(r.salida).toContain('La clase 1smr no existe');
  });
});
