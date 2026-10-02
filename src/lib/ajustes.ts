import type { EstiloPassword } from './passwords';
import { CENTRO } from './centro';

export interface Ajustes {
  realm: string;
  rol: string;
  storage: string;
  rolStorage: string;
  cuotaGB: number;
  estiloPassword: EstiloPassword;
  urlProxmox: string;
  centro: string;
}

export const AJUSTES_POR_DEFECTO: Ajustes = {
  realm: 'pve',
  rol: 'Alumno',
  storage: 'local-lvm',
  rolStorage: '',
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
    return guardado ? { ...AJUSTES_POR_DEFECTO, ...JSON.parse(guardado) } : { ...AJUSTES_POR_DEFECTO };
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

export function descargar(nombre: string, contenido: string, tipo = 'text/plain') {
  const url = URL.createObjectURL(new Blob([contenido], { type: `${tipo};charset=utf-8` }));
  const a = Object.assign(document.createElement('a'), { href: url, download: nombre });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
