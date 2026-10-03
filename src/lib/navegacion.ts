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
    descripcion: 'Clases con un pool por alumno: altas y bajas, utilidades para el día a día en el aula y seguimiento.',
    enlaces: [
      { grupo: 'Altas y bajas', href: '/proxmox/crear/', nombre: 'Crear usuarios', icono: 'usuarioMas', descripcion: 'Una clase desde el TXT de la lista o un solo usuario.' },
      { grupo: 'Altas y bajas', href: '/proxmox/borrar/', nombre: 'Borrar usuarios', icono: 'papelera', descripcion: 'Una clase entera, una lista o un solo usuario, con sus VMs.' },
      { grupo: 'Altas y bajas', href: '/proxmox/mover/', nombre: 'Mover alumno', icono: 'mover', descripcion: 'Cambia a un alumno de clase conservando sus máquinas.' },
      { grupo: 'Altas y bajas', href: '/proxmox/profesores/', nombre: 'Profesores', icono: 'usuarios', descripcion: 'Añade o quita profesores de una clase.' },
      { grupo: 'En el aula', href: '/proxmox/energia/', nombre: 'Encender y apagar', icono: 'energia', descripcion: 'Toda la clase o algunos alumnos, de una vez.' },
      { grupo: 'En el aula', href: '/proxmox/snapshots/', nombre: 'Snapshots', icono: 'camara', descripcion: 'Crea, revisa o vuelve a un snapshot en toda la clase.' },
      { grupo: 'En el aula', href: '/proxmox/repartir/', nombre: 'Repartir plantilla', icono: 'copiar', descripcion: 'Una copia de la plantilla en el pool de cada alumno.' },
      { grupo: 'En el aula', href: '/proxmox/recoger/', nombre: 'Recoger prácticas', icono: 'bandeja', descripcion: 'Congela lo entregado con un snapshot para corregir.' },
      { grupo: 'En el aula', href: '/proxmox/limpiar/', nombre: 'Limpiar práctica', icono: 'escoba', descripcion: 'Destruye las máquinas de una práctica terminada.' },
      { grupo: 'Seguimiento', href: '/proxmox/estado/', nombre: 'Estado de la clase', icono: 'lista', descripcion: 'Qué tiene cada alumno, qué está encendido y cuánto ocupa.' },
      { grupo: 'Seguimiento', href: '/proxmox/auditoria/', nombre: 'Uso de disco', icono: 'medidor', descripcion: 'Quién se ha pasado de su cuota. Se puede programar a diario.' },
      { grupo: 'Seguimiento', href: '/proxmox/contrasenas/', nombre: 'Contraseñas', icono: 'llave', descripcion: '«He olvidado la contraseña»: una nueva y su papeleta.' },
      { grupo: 'Configuración', href: '/proxmox/ajustes/', nombre: 'Ajustes', icono: 'ajustes', descripcion: 'Storages, plantillas, roles, cuota y URL del Proxmox por defecto.' },
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
