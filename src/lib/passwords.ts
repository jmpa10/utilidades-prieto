export type EstiloPassword = 'legible' | 'fuerte';

const ANIMALES = [
  'Lince', 'Aguila', 'Tigre', 'Panda', 'Zorro', 'Lobo', 'Oso', 'Gato', 'Koala', 'Delfin', 'Tucan', 'Bisonte',
  'Halcon', 'Buho', 'Nutria', 'Erizo', 'Castor', 'Ciervo', 'Gacela', 'Jaguar', 'Puma', 'Foca', 'Morsa', 'Pinguino',
  'Camello', 'Cebra', 'Jirafa', 'Hipopotamo', 'Rinoceronte', 'Canguro', 'Mapache', 'Ardilla', 'Conejo', 'Raton',
  'Leon', 'Elefante', 'Gorila', 'Llama', 'Alpaca', 'Iguana', 'Tortuga', 'Pulpo', 'Medusa', 'Ballena', 'Tiburon',
  'Salmon', 'Cuervo', 'Gaviota', 'Flamenco', 'Pelicano', 'Colibri', 'Grulla', 'Cisne', 'Pavo', 'Gallo', 'Caballo',
  'Burro', 'Cabra', 'Oveja', 'Toro', 'Bufalo', 'Chacal', 'Hiena', 'Suricato',
];
const ADJETIVOS = [
  'Rojo', 'Azul', 'Verde', 'Dorado', 'Plata', 'Veloz', 'Feliz', 'Sabio', 'Bravo', 'Agil', 'Fuerte', 'Tenaz',
  'Audaz', 'Noble', 'Alegre', 'Astuto', 'Atento', 'Calmo', 'Curioso', 'Firme', 'Genial', 'Grande', 'Habil', 'Leal',
  'Libre', 'Lucido', 'Magico', 'Rapido', 'Sereno', 'Solar', 'Lunar', 'Polar', 'Nocturno', 'Electrico', 'Cosmico',
  'Brillante', 'Valiente', 'Ingenioso', 'Tranquilo', 'Paciente', 'Amable', 'Creativo', 'Dinamico', 'Epico',
  'Estelar', 'Fiel', 'Gentil', 'Honesto', 'Intrepido', 'Jovial', 'Mistico', 'Optimo', 'Pionero', 'Radiante',
  'Sincero', 'Tecnico', 'Unico', 'Vivo', 'Zen', 'Cuantico', 'Digital', 'Binario', 'Turbo', 'Neon',
];
// Sin caracteres ambiguos (0/O, 1/l/I).
const ALFABETO = 'abcdefghijkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Entero uniforme en [0, max) con crypto y muestreo por rechazo. */
export function aleatorio(max: number): number {
  const limite = Math.floor(0x100000000 / max) * max;
  const buf = new Uint32Array(1);
  do crypto.getRandomValues(buf);
  while (buf[0] >= limite);
  return buf[0] % max;
}

function elegir<T>(lista: T[]): T {
  return lista[aleatorio(lista.length)];
}

/** «Lince-Verde-472» (legible) o 14 caracteres aleatorios (fuerte). */
export function generarPassword(estilo: EstiloPassword = 'legible'): string {
  if (estilo === 'fuerte') {
    return Array.from({ length: 14 }, () => elegir([...ALFABETO])).join('');
  }
  return `${elegir(ANIMALES)}-${elegir(ADJETIVOS)}-${100 + aleatorio(900)}`;
}
