import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { scriptCreacion, type OpcionesCreacion } from '../src/lib/proxmox/create';
import { scriptBorrado } from '../src/lib/proxmox/delete';
import { scriptAuditoria } from '../src/lib/proxmox/audit';

// Proxmox simulado (tests/mock/pve.py) enlazado como pveum, pvesh y pveversion.
const dir = mkdtempSync(join(tmpdir(), 'pve-'));
const bin = join(dir, 'bin');
spawnSync('mkdir', [bin]);
for (const c of ['pveum', 'pvesh', 'pveversion']) symlinkSync(resolve('tests/mock/pve.py'), join(bin, c));
const estado = join(dir, 'estado.json');
afterAll(() => rmSync(dir, { recursive: true, force: true }));

const VACIO = { version: '8.2.4', users: {}, groups: {}, pools: {}, roles: ['Alumno', 'PVEDatastoreUser'], acl: [], storages: ['local-lvm'], vms: {} };
const leer = () => JSON.parse(readFileSync(estado, 'utf8'));
const escribir = (s: object) => writeFileSync(estado, JSON.stringify(s));

function ejecutar(script: string, args: string[] = []) {
  const fichero = join(dir, 'script.sh');
  // En el Mac no somos root: se salta solo esa comprobación.
  writeFileSync(fichero, script.replace('[[ $EUID -eq 0 ]]', 'true'));
  const r = spawnSync('bash', [fichero, ...args], {
    encoding: 'utf8',
    env: { ...process.env, PATH: `${bin}:${process.env.PATH}`, PVE_STATE: estado },
  });
  return { codigo: r.status, salida: r.stdout + r.stderr };
}

const base: OpcionesCreacion = {
  clase: '2asir',
  claseNombre: '2º ASIR',
  realm: 'pve',
  rol: 'Alumno',
  cuotaGB: 50,
  storage: 'local-lvm',
  rolStorage: 'PVEDatastoreUser',
  usuarios: [
    { base: 'jperez', nombre: 'Juan Pérez García', password: `Lince-Verde-1'$!` },
    { base: 'mfuente', nombre: 'María José de la Fuente', password: 'Oso-Azul-222' },
    { base: 'anunez', nombre: 'Ángel Núñez', password: 'Puma-Zen-333' },
  ],
  fecha: new Date('2026-10-02T10:00:00'),
};

describe('sintaxis', () => {
  it('los tres scripts pasan bash -n', () => {
    for (const s of [
      scriptCreacion(base),
      scriptBorrado({ modo: 'clase', clase: '2asir', realm: 'pve', bases: [] }),
      scriptBorrado({ modo: 'lista', clase: '2asir', realm: 'pve', bases: ['jperez'] }),
      scriptAuditoria({ clase: '2asir', umbralAviso: 90 }),
    ]) {
      expect(spawnSync('bash', ['-n'], { input: s }).status).toBe(0);
    }
  });
});

describe('creación', () => {
  beforeEach(() => escribir(VACIO));

  it('crea grupo, pools anidados, usuarios y permisos', () => {
    const r = ejecutar(scriptCreacion(base));
    expect(r.codigo, r.salida).toBe(0);
    const s = leer();
    expect(Object.keys(s.groups)).toEqual(['2asir']);
    expect(Object.keys(s.pools)).toEqual(['2asir', '2asir/jperez-2asir', '2asir/mfuente-2asir', '2asir/anunez-2asir']);
    expect(s.pools['2asir/jperez-2asir']).toEqual({ comment: 'quota=50G; Juan Pérez García', storage: ['local-lvm'] });
    expect(s.users['jperez-2asir@pve']).toEqual({ groups: ['2asir'], comment: 'Juan Pérez García', password: `Lince-Verde-1'$!` });
    expect(s.acl).toContainEqual(['/pool/2asir/jperez-2asir', 'user', 'jperez-2asir@pve', 'Alumno']);
    expect(s.acl).toContainEqual(['/storage/local-lvm', 'group', '2asir', 'PVEDatastoreUser']);
    expect(r.salida).toContain('Creados: 3');
  });

  it('es idempotente', () => {
    ejecutar(scriptCreacion(base));
    const r = ejecutar(scriptCreacion(base));
    expect(r.codigo, r.salida).toBe(0);
    expect(r.salida).toContain('Creados: 0');
    expect(r.salida).toContain('Ya existían: 3');
  });

  it('--dry-run no cambia nada ni muestra contraseñas', () => {
    const r = ejecutar(scriptCreacion(base), ['--dry-run']);
    expect(r.codigo, r.salida).toBe(0);
    expect(leer().users).toEqual({});
    expect(r.salida).not.toContain('Oso-Azul-222');
  });

  it('aborta si el rol no existe', () => {
    escribir({ ...VACIO, roles: [] });
    const r = ejecutar(scriptCreacion(base));
    expect(r.codigo).toBe(1);
    expect(r.salida).toContain("El rol 'Alumno' no existe");
  });

  it('aborta en Proxmox < 8.1 si hay clase', () => {
    escribir({ ...VACIO, version: '7.4.3' });
    expect(ejecutar(scriptCreacion(base)).codigo).toBe(1);
  });

  it('usuario individual sin clase: pool plano y sin grupo', () => {
    const r = ejecutar(scriptCreacion({ ...base, clase: '', claseNombre: '', storage: '', cuotaGB: null, usuarios: [{ base: 'profe', nombre: 'Profe', password: 'x-y-1' }] }));
    expect(r.codigo, r.salida).toBe(0);
    const s = leer();
    expect(s.pools).toEqual({ profe: { comment: 'Profe', storage: [] } });
    expect(s.users['profe@pve'].groups).toEqual([]);
  });
});

describe('auditoría y borrado', () => {
  beforeEach(() => {
    escribir(VACIO);
    ejecutar(scriptCreacion(base));
    const s = leer();
    s.vms = {
      'qemu/100': { node: 'pve1', pool: '2asir/jperez-2asir', status: 'running', config: { scsi0: 'local-lvm:vm-100-disk-0,size=64G', ide2: 'local:iso/d.iso,media=cdrom,size=600M', efidisk0: 'local-lvm:vm-100-disk-1,size=4M' } },
      'lxc/101': { node: 'pve2', pool: '2asir/jperez-2asir', status: 'running', config: { rootfs: 'local-lvm:vm-101-disk-0,size=8G' } },
      'qemu/102': { node: 'pve1', pool: '2asir/anunez-2asir', status: 'stopped', config: { virtio0: 'local-lvm:vm-102-disk-0,size=20G' } },
    };
    escribir(s);
  });

  it('la auditoría detecta quien supera la cuota', () => {
    const r = ejecutar(scriptAuditoria({ clase: '2asir', umbralAviso: 90 }));
    expect(r.codigo).toBe(1);
    expect(r.salida).toMatch(/2asir\/jperez-2asir\s+2\s+72\.0\s+50\s+144%\s+EXCEDIDO/);
    expect(r.salida).toMatch(/2asir\/anunez-2asir\s+1\s+20\.0\s+50\s+40%\s+ok/);
  });

  it('sin --yes y sin terminal no borra', () => {
    const r = ejecutar(scriptBorrado({ modo: 'clase', clase: '2asir', realm: 'pve', bases: [] }));
    expect(r.codigo).toBe(1);
    expect(Object.keys(leer().users)).toHaveLength(3);
  });

  it('borra toda la clase: VMs, pools, usuarios, pool padre y grupo', () => {
    const r = ejecutar(scriptBorrado({ modo: 'clase', clase: '2asir', realm: 'pve', bases: [] }), ['--yes']);
    expect(r.codigo, r.salida).toBe(0);
    expect(r.salida).toContain('3 usuario(s) · 3 VM/CT');
    const s = leer();
    expect(s).toMatchObject({ users: {}, pools: {}, groups: {}, vms: {} });
  });

  it('borra un único usuario y deja el resto', () => {
    const r = ejecutar(scriptBorrado({ modo: 'usuario', clase: '2asir', realm: 'pve', bases: ['jperez'] }), ['--yes']);
    expect(r.codigo, r.salida).toBe(0);
    const s = leer();
    expect(Object.keys(s.users)).toEqual(['mfuente-2asir@pve', 'anunez-2asir@pve']);
    expect(Object.keys(s.vms)).toEqual(['qemu/102']);
    expect(s.pools['2asir']).toBeDefined();
  });

  it('--dry-run del borrado no toca nada', () => {
    const antes = leer();
    const r = ejecutar(scriptBorrado({ modo: 'lista', clase: '2asir', realm: 'pve', bases: ['jperez', 'anunez'] }), ['--dry-run']);
    expect(r.codigo, r.salida).toBe(0);
    const despues = leer();
    expect(despues.users).toEqual(antes.users);
    expect(despues.vms).toEqual(antes.vms);
  });
});
