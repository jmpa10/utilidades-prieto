/** Menú del portal. Para añadir una utilidad: crea sus páginas en src/pages/<id>/ y añádela aquí. */
export interface Seccion {
  id: string;
  nombre: string;
  icono: string;
  descripcion: string;
  pronto?: boolean;
  enlaces: { grupo?: string; href: string; nombre: string; icono: string; descripcion: string }[];
}

export const SECCIONES: Seccion[] = [
  {
    id: 'proxmox',
    nombre: 'Proxmox',
    icono: 'servidor',
    descripcion: 'Cada alumno con su propio espacio para crear máquinas virtuales, organizado por clases.',
    enlaces: [
      { grupo: 'Preparar el curso', href: '/proxmox/crear/', nombre: 'Crear usuarios', icono: 'usuarioMas', descripcion: 'Una clase entera desde su lista, o una sola persona' },
      { grupo: 'Preparar el curso', href: '/proxmox/profesores/', nombre: 'Profesores de una clase', icono: 'usuarios', descripcion: 'Quién puede ver y gestionar cada clase' },
      { grupo: 'En clase', href: '/proxmox/energia/', nombre: 'Encender y apagar', icono: 'energia', descripcion: 'Todas las máquinas de la clase de una vez' },
      { grupo: 'En clase', href: '/proxmox/repartir/', nombre: 'Repartir una plantilla', icono: 'copiar', descripcion: 'Una copia de la máquina de la práctica para cada alumno' },
      { grupo: 'En clase', href: '/proxmox/snapshots/', nombre: 'Snapshots', icono: 'camara', descripcion: 'Guardar el estado antes de una práctica y volver a él' },
      { grupo: 'En clase', href: '/proxmox/recoger/', nombre: 'Recoger prácticas', icono: 'bandeja', descripcion: 'Congelar lo entregado para corregirlo' },
      { grupo: 'Seguimiento', href: '/proxmox/estado/', nombre: 'Estado de la clase', icono: 'lista', descripcion: 'Qué tiene cada alumno y qué está encendido' },
      { grupo: 'Seguimiento', href: '/proxmox/contrasenas/', nombre: 'Restablecer contraseñas', icono: 'llave', descripcion: 'Para quien ha olvidado la suya' },
      { grupo: 'Seguimiento', href: '/proxmox/auditoria/', nombre: 'Uso de disco', icono: 'medidor', descripcion: 'Quién se ha pasado de su cuota' },
      { grupo: 'Cambios y final de curso', href: '/proxmox/mover/', nombre: 'Mover un alumno de clase', icono: 'mover', descripcion: 'Conserva sus máquinas' },
      { grupo: 'Cambios y final de curso', href: '/proxmox/limpiar/', nombre: 'Limpiar una práctica', icono: 'escoba', descripcion: 'Borrar las máquinas de una práctica terminada' },
      { grupo: 'Cambios y final de curso', href: '/proxmox/borrar/', nombre: 'Borrar usuarios', icono: 'papelera', descripcion: 'Una clase entera o algunos alumnos, con sus máquinas' },
    ],
  },
  {
    id: 'dokploy',
    nombre: 'Dokploy',
    icono: 'cohete',
    descripcion: 'Despliegue de aplicaciones de los alumnos. En preparación.',
    pronto: true,
    enlaces: [{ href: '/dokploy/', nombre: 'En preparación', icono: 'cohete', descripcion: '' }],
  },
];

/** Agrupa los enlaces de una sección por su campo «grupo», en orden de aparición. */
export function porGrupos(enlaces: Seccion['enlaces']): [string, Seccion['enlaces']][] {
  const grupos = new Map<string, Seccion['enlaces']>();
  for (const e of enlaces) grupos.set(e.grupo ?? '', [...(grupos.get(e.grupo ?? '') ?? []), e]);
  return [...grupos];
}
