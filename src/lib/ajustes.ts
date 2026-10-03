import type { EstiloPassword } from './passwords';
import { CENTRO } from './centro';

export interface Ajustes {
  realm: string;
  rol: string;
  /** Storage de los discos de las VMs (se añade a cada pool). */
  storage: string;
  /** Storage de las ISOs: los alumnos las usan y los profesores las suben. */
  storageIsos: string;
  /** Pool común de plantillas para clonar (vacío: no se usa). */
  poolPlantillas: string;
  /** Roles de los profesores sobre el pool de la clase. */
  rolesProfesor: string;
  /** Bridge de cada clase («2asir» → «vmbr2asir»), recordado al generar. */
  bridges: Record<string, string>;
  cuotaGB: number;
  estiloPassword: EstiloPassword;
  urlProxmox: string;
  centro: string;
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  realm: 'pve',
  rol: 'Alumno',
  storage: 'ssd-vms',
  storageIsos: 'isos-hdd',
  poolPlantillas: '',
  rolesProfesor: 'PVEVMAdmin,PVEPoolUser,PVEDatastoreUser',
  bridges: {},
  cuotaGB: 50,
  estiloPassword: 'legible',
  urlProxmox: '',
  centro: CENTRO.nombre,
};

const CLAVE = 'utilidades-prieto:proxmox:ajustes';

/** Preferencias por navegador. Si el almacenamiento falla, se usan los valores por defecto. */
export function leerAjustes(): Ajustes {
  try {
    const guardado = localStorage.getItem(CLAVE);
    if (!guardado) return { ...AJUSTES_POR_DEFECTO };
    const leido = JSON.parse(guardado);
    // Solo se conservan las claves actuales (las de versiones anteriores se descartan).
    const a = { ...AJUSTES_POR_DEFECTO };
    for (const k of Object.keys(a) as (keyof Ajustes)[]) if (k in leido) (a as Record<string, unknown>)[k] = leido[k];
    return a;
  } catch {
    return { ...AJUSTES_POR_DEFECTO };
  }
}

export function guardarAjustes(a: Ajustes): boolean {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(a));
    return true;
  } catch {
    return false;
  }
}

/** Recuerda el bridge de una clase para proponerlo la próxima vez. */
export function recordarBridge(clase: string, bridge: string) {
  if (!clase || !bridge) return;
  const a = leerAjustes();
  if (a.bridges[clase] === bridge) return;
  guardarAjustes({ ...a, bridges: { ...a.bridges, [clase]: bridge } });
}

export function descargar(nombre: string, contenido: string, tipo = 'text/plain') {
  const url = URL.createObjectURL(new Blob([contenido], { type: `${tipo};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
