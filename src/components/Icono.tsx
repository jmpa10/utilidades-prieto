/** Iconos de línea (24×24, trazo 2) en SVG en línea: sin dependencias externas. */
const RUTAS: Record<string, string> = {
  servidor: 'M4 4h16v6H4zM4 14h16v6H4zM8 7h.01M8 17h.01M12 7h4M12 17h4',
  cohete: 'M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M13.5 6.5a8 8 0 0 1 5-3.5 8 8 0 0 1-3.5 5L9 14l-3-3zM9 14l1 4 3-2M6 11l-3-1 2-3h4',
  usuarios: 'M16 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 20v-1a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  usuarioMas: 'M15 20v-1a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v1M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M16 11h6',
  papelera: 'M3 6h18M8 6V4h8v2M6 6l1 14h10l1-14M10 11v5M14 11v5',
  medidor: 'M12 14l4-4M3.5 18a9 9 0 1 1 17 0',
  ajustes: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6',
  subir: 'M12 16V4M7 9l5-5 5 5M4 16v4h16v-4',
  copiar: 'M9 9h11v11H9zM5 15H4V4h11v1',
  descargar: 'M12 4v12M7 11l5 5 5-5M4 20h16',
  imprimir: 'M6 9V3h12v6M6 18H4v-7h16v7h-2M7 14h10v7H7z',
  alerta: 'M12 3l10 18H2zM12 10v4M12 18h.01',
  check: 'M4 12l5 5L20 6',
  sol: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  luna: 'M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z',
  casa: 'M3 11l9-8 9 8M5 9v12h14V9M10 21v-6h4v6',
  fichero: 'M14 3H6v18h12V7zM14 3v4h4M9 13h6M9 17h6',
  terminal: 'M3 4h18v16H3zM7 9l3 3-3 3M13 15h4',
  atras: 'M15 18l-6-6 6-6',
  adelante: 'M9 18l6-6-6-6',
  dados: 'M4 4h16v16H4zM8.5 8.5h.01M15.5 15.5h.01M15.5 8.5h.01M8.5 15.5h.01M12 12h.01',
  github: 'M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.4 5.4 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4M9 18c-4.51 2-5-2-7-2',
  energia: 'M12 2v10M18.4 6.6a9 9 0 1 1-12.8 0',
  camara: 'M3 7h4l2-3h6l2 3h4v13H3zM12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z',
  bandeja: 'M22 12h-6l-2 3h-4l-2-3H2M5.5 5h13L22 12v7H2v-7z',
  escoba: 'M19 3l-7 7M9 11l4 4M4 21c0-4 2-8 5-10l4 4c-2 3-6 5-9 6zM7 18l2-2',
  lista: 'M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01',
  llave: 'M15 7a4 4 0 1 1-3.9 5H3v3h3v3h3v-3h2.1A4 4 0 0 1 15 7zM16 11h.01',
  mover: 'M5 9l-3 3 3 3M19 9l3 3-3 3M2 12h20M9 5l3-3 3 3M15 19l-3 3-3-3',
  info: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20zM12 16v-4M12 8h.01',
};

export type NombreIcono = keyof typeof RUTAS;

export default function Icono({ nombre, tam = 20, titulo }: { nombre: string; tam?: number; titulo?: string }) {
  return (
    <svg
      width={tam}
      height={tam}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden={titulo ? undefined : 'true'}
      role={titulo ? 'img' : undefined}
    >
      {titulo && <title>{titulo}</title>}
      <path d={RUTAS[nombre] ?? RUTAS.info} />
    </svg>
  );
}
