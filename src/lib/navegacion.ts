/** Menú del portal. Para añadir una utilidad: crea sus páginas en src/pages/<id>/ y añádela aquí. */
export interface Seccion {
  id: string;
  nombre: string;
  icono: string;
  descripcion: string;
  pronto?: boolean;
  enlaces: { href: string; nombre: string; icono: string; descripcion: string }[];
}

export const SECCIONES: Seccion[] = [
  {
    id: 'proxmox',
    nombre: 'Proxmox',
    icono: 'servidor',
    descripcion: 'Da de alta a una clase entera con un usuario y un pool de recursos por alumno, o bórrala al terminar el curso.',
    enlaces: [
      { href: '/proxmox/crear/', nombre: 'Crear usuarios', icono: 'usuarioMas', descripcion: 'Desde un TXT con la lista de la clase o de uno en uno.' },
      { href: '/proxmox/borrar/', nombre: 'Borrar usuarios', icono: 'papelera', descripcion: 'Una clase entera, una lista o un solo usuario, con sus VMs.' },
      { href: '/proxmox/auditoria/', nombre: 'Uso de disco', icono: 'medidor', descripcion: 'Comprueba quién se ha pasado de la cuota de su pool.' },
      { href: '/proxmox/ajustes/', nombre: 'Ajustes', icono: 'ajustes', descripcion: 'Storages, plantillas, roles, cuota y URL del Proxmox por defecto.' },
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
