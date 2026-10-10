import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawnSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { homedir, tmpdir } from 'node:os';
import { join } from 'node:path';
import { cadena, identificador } from '../src/lib/terraform/hcl';
import { proyectoClase, type OpcionesProyecto } from '../src/lib/terraform/clase';
import { ficheroRepartir, tfRepartir } from '../src/lib/terraform/repartir';
import { crearZip } from '../src/lib/zip';
import { poolDe, usuarioCompleto } from '../src/lib/names';
import type { OpcionesRepartir } from '../src/lib/proxmox/repartir';

const DIFICIL = `Ra"ro\\-\${var.x}-%{if}-'$!`;

const base: OpcionesProyecto = {
  endpoint: 'https://pve.centro:8006/',
  clase: 'asir2',
  claseNombre: '2º ASIR "B"',
  realm: 'pve',
  rol: 'Alumno',
  cuotaGB: 50,
  storage: 'ssd-vms',
  storageIsos: 'isos-hdd',
  bridge: 'vmbrasir2',
  poolPlantillas: 'plantillas',
  profesores: ['profe1@pve', 'profe2@pve'],
  rolesProfesor: 'PVEVMAdmin,PVEPoolUser,PVEDatastoreUser',
  usuarios: [
    { base: 'jperez', nombre: 'Juan Pérez García', password: DIFICIL },
    { base: 'mfuente', nombre: "María José de la Fuente O'Neill", password: 'Oso-Azul-222' },
    { base: '2anunez', nombre: 'Ángel Núñez', password: 'Puma-Zen-333' },
  ],
  fecha: new Date('2026-10-02T10:00:00'),
};

const repartir: OpcionesRepartir = { clase: 'asir2', bases: [], plantilla: 'debian-12-base', prefijo: 'debian-12', storage: 'ssd-vms', encender: false };

describe('hcl', () => {
  it('escapa comillas, barras y plantillas', () => {
    expect(cadena(DIFICIL)).toBe(`"Ra\\"ro\\\\-$\${var.x}-%%{if}-'$!"`);
    expect(cadena('a\nb')).toBe('"a\\nb"');
  });

  it('convierte prefijos en identificadores válidos', () => {
    expect(identificador('debian-12')).toBe('debian_12');
    expect(identificador('9front')).toBe('_9front');
  });
});

describe('proyecto de clase', () => {
  const p = proyectoClase(base);

  it('trae los ficheros esperados', () => {
    expect(Object.keys(p)).toEqual(['LEEME.md', 'terraform.tfvars', 'main.tf', 'variables.tf', 'versions.tf', '.gitignore']);
    expect(p['.gitignore']).toMatch(/^terraform\.tfvars$/m);
    expect(p['.gitignore']).toMatch(/^\*\.tfstate$/m);
  });

  it('no pone credenciales de Proxmox en los ficheros', () => {
    expect(p['versions.tf']).not.toMatch(/api_token\s*=/);
    expect(p['terraform.tfvars']).not.toMatch(/token|PROXMOX_VE/);
  });

  it('usa el endpoint de los ajustes o un marcador para rellenar', () => {
    expect(p['terraform.tfvars']).toContain('endpoint        = "https://pve.centro:8006/"');
    expect(proyectoClase({ ...base, endpoint: '' })['terraform.tfvars']).toContain('https://IP_DEL_PROXMOX:8006/');
  });

  it('separa los roles de profesor y deja la cuota vacía como null', () => {
    const t = proyectoClase({ ...base, cuotaGB: null })['terraform.tfvars'];
    expect(t).toContain('roles_profesor  = ["PVEVMAdmin", "PVEPoolUser", "PVEDatastoreUser"]');
    expect(t).toContain('cuota_gb        = null');
  });
});

describe('repartir', () => {
  it('busca la plantilla por nombre o por VMID', () => {
    expect(tfRepartir(repartir)).toContain('vm.name == "debian-12-base"');
    expect(tfRepartir({ ...repartir, plantilla: '9000' })).toContain('vm.vm_id == 9000');
  });

  it('toda la clase o solo algunos alumnos', () => {
    expect(tfRepartir(repartir)).toMatch(/alumnos_debian_12\s+= local\.alumnos$/m);
    expect(tfRepartir({ ...repartir, bases: ['jperez'] })).toContain('if contains(["jperez"], base)');
  });

  it('sin storage, los discos van al de la plantilla', () => {
    expect(tfRepartir(repartir)).toContain('target_datastore = "ssd-vms"');
    expect(tfRepartir({ ...repartir, storage: '' })).not.toContain('target_datastore');
  });

  it('nombra el fichero por el prefijo', () => {
    expect(ficheroRepartir('debian-12')).toBe('repartir-debian-12.tf');
  });
});

describe('zip', () => {
  const unzip = spawnSync('unzip', ['-v']).status === 0;
  it.skipIf(!unzip)('se abre con unzip y conserva el contenido', () => {
    const dir = mkdtempSync(join(tmpdir(), 'zip-'));
    try {
      const ficheros = { 'LEEME.md': 'Ñandú «hola»\n', 'sub/main.tf': 'x = 1\n', vacio: '' };
      const fichero = join(dir, 'p.zip');
      writeFileSync(fichero, crearZip(ficheros, 'terraform-asir2'));
      expect(spawnSync('unzip', ['-t', fichero]).status).toBe(0);
      expect(spawnSync('unzip', ['-p', fichero, 'terraform-asir2/LEEME.md'], { encoding: 'utf8' }).stdout).toBe('Ñandú «hola»\n');
      expect(spawnSync('unzip', ['-Z1', fichero], { encoding: 'utf8' }).stdout.trim().split('\n')).toEqual([
        'terraform-asir2/LEEME.md',
        'terraform-asir2/sub/main.tf',
        'terraform-asir2/vacio',
      ]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

// Con Terraform instalado se comprueba el proyecto de verdad: formato, validación
// y que las variables llegan intactas (contraseñas difíciles incluidas).
// La primera vez descarga el provider a ~/.terraform.d/plugin-cache.
const terraform = spawnSync('terraform', ['version']).status === 0;
describe.skipIf(!terraform)('terraform', () => {
  const dir = mkdtempSync(join(tmpdir(), 'tf-'));
  const tf = (args: string[], input?: string) =>
    spawnSync('terraform', args, {
      cwd: dir,
      input,
      encoding: 'utf8',
      env: { ...process.env, TF_IN_AUTOMATION: '1', TF_PLUGIN_CACHE_DIR: join(homedir(), '.terraform.d', 'plugin-cache') },
    });
  const consola = (expr: string) => {
    const r = tf(['console'], expr);
    expect(r.status, r.stderr).toBe(0);
    return JSON.parse(JSON.parse(r.stdout.trim()));
  };

  beforeAll(() => {
    mkdirSync(join(homedir(), '.terraform.d', 'plugin-cache'), { recursive: true });
    for (const [nombre, contenido] of Object.entries(proyectoClase(base))) writeFileSync(join(dir, nombre), contenido);
    writeFileSync(join(dir, ficheroRepartir('debian-12')), tfRepartir(repartir));
    writeFileSync(join(dir, ficheroRepartir('win')), tfRepartir({ ...repartir, prefijo: 'win', plantilla: '9000', bases: ['jperez'], storage: '', encender: true }));
    const r = tf(['init', '-backend=false', '-input=false']);
    expect(r.status, r.stdout + r.stderr).toBe(0);
  }, 300_000);
  afterAll(() => rmSync(dir, { recursive: true, force: true }));

  it('tiene el formato de terraform fmt', () => {
    const r = tf(['fmt', '-check', '-diff']);
    expect(r.status, r.stdout).toBe(0);
  });

  it('pasa terraform validate', () => {
    const r = tf(['validate', '-no-color']);
    expect(r.status, r.stdout + r.stderr).toBe(0);
  });

  it('las variables llegan intactas', () => {
    expect(consola('jsonencode(var.alumnos)')).toEqual(Object.fromEntries(base.usuarios.map((u) => [u.base, { nombre: u.nombre, password: u.password }])));
    expect(consola('jsonencode(var.clase)')).toEqual({ id: 'asir2', nombre: '2º ASIR "B"' });
  });

  it('usuarios y pools coinciden con los del script', () => {
    const esperado = Object.fromEntries(base.usuarios.map((u) => [`${usuarioCompleto(u.base, base.clase)}@${base.realm}`, poolDe(u.base, base.clase)]));
    expect(consola('jsonencode({ for a in local.alumnos : "${a.usuario}@${var.realm}" => a.pool })')).toEqual(esperado);
  });

  it('rechaza una clase que empieza por número', () => {
    const vars = readFileSync(join(dir, 'terraform.tfvars'), 'utf8').replace('id     = "asir2"', 'id     = "2asir"');
    writeFileSync(join(dir, 'malo.tfvars'), vars);
    const r = tf(['plan', '-input=false', '-refresh=false', '-var-file=malo.tfvars', '-no-color']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('debe empezar por una letra');
  });
});
