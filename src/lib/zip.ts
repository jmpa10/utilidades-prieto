/** ZIP sin compresión (método STORE): suficiente para unos pocos ficheros de texto y sin dependencias. */

const TABLA_CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(datos: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of datos) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Fecha y hora en formato MS-DOS. */
function fechaDos(d: Date): [number, number] {
  const hora = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const fecha = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return [hora, fecha];
}

/** Empaqueta los ficheros (ruta → contenido de texto, en UTF-8) dentro de una carpeta. */
export function crearZip(ficheros: Record<string, string>, carpeta = '', fecha = new Date()): Uint8Array<ArrayBuffer> {
  const utf8 = new TextEncoder();
  const [hora, dia] = fechaDos(fecha);
  const locales: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let desplazamiento = 0;

  for (const [ruta, texto] of Object.entries(ficheros)) {
    const nombre = utf8.encode(carpeta ? `${carpeta}/${ruta}` : ruta);
    const datos = utf8.encode(texto);
    const crc = crc32(datos);

    const local = new Uint8Array(30 + nombre.length + datos.length);
    const l = new DataView(local.buffer);
    l.setUint32(0, 0x04034b50, true);
    l.setUint16(4, 20, true); // versión necesaria
    l.setUint16(6, 0x0800, true); // nombres en UTF-8
    l.setUint16(8, 0, true); // STORE
    l.setUint16(10, hora, true);
    l.setUint16(12, dia, true);
    l.setUint32(14, crc, true);
    l.setUint32(18, datos.length, true);
    l.setUint32(22, datos.length, true);
    l.setUint16(26, nombre.length, true);
    local.set(nombre, 30);
    local.set(datos, 30 + nombre.length);
    locales.push(local);

    const entrada = new Uint8Array(46 + nombre.length);
    const c = new DataView(entrada.buffer);
    c.setUint32(0, 0x02014b50, true);
    c.setUint16(4, 20, true);
    c.setUint16(6, 20, true);
    c.setUint16(8, 0x0800, true);
    c.setUint16(10, 0, true);
    c.setUint16(12, hora, true);
    c.setUint16(14, dia, true);
    c.setUint32(16, crc, true);
    c.setUint32(20, datos.length, true);
    c.setUint32(24, datos.length, true);
    c.setUint16(28, nombre.length, true);
    c.setUint32(42, desplazamiento, true);
    entrada.set(nombre, 46);
    central.push(entrada);

    desplazamiento += local.length;
  }

  const tamCentral = central.reduce((t, e) => t + e.length, 0);
  const fin = new Uint8Array(22);
  const f = new DataView(fin.buffer);
  f.setUint32(0, 0x06054b50, true);
  f.setUint16(8, central.length, true);
  f.setUint16(10, central.length, true);
  f.setUint32(12, tamCentral, true);
  f.setUint32(16, desplazamiento, true);

  const partes = [...locales, ...central, fin];
  const zip = new Uint8Array(partes.reduce((t, p) => t + p.length, 0));
  let i = 0;
  for (const p of partes) {
    zip.set(p, i);
    i += p.length;
  }
  return zip;
}
