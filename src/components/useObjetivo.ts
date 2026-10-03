import { useEffect, useState } from 'preact/hooks';
import { AJUSTES_POR_DEFECTO, leerAjustes, type Ajustes } from '../lib/ajustes';
import type { Objetivo } from '../lib/proxmox/objetivo';

/** Estado común de las utilidades del aula: ajustes del navegador y objetivo elegido. */
export function useObjetivo() {
  const [ajustes, setAjustes] = useState<Ajustes>(AJUSTES_POR_DEFECTO);
  const [objetivo, setObjetivo] = useState<Objetivo>({ clase: '', bases: [], filtro: '', etiqueta: '' });
  const [valido, setValido] = useState(false);
  useEffect(() => setAjustes(leerAjustes()), []);
  const onChange = (o: Objetivo, v: boolean) => {
    setObjetivo(o);
    setValido(v);
  };
  return { ajustes, objetivo, valido, onChange };
}
