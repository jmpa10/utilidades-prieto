import { useState } from 'preact/hooks';
import SelectorObjetivo from './SelectorObjetivo';
import VisorScript, { type Variante } from './VisorScript';
import { useObjetivo } from './useObjetivo';
import { scriptEnergia } from '../lib/proxmox/energia';

const VARIANTES: Variante[] = [
  { id: 'ver', nombre: 'Ver', args: ['ver'], explicacion: 'Lista las máquinas y si están encendidas. No cambia nada.' },
  { id: 'apagar', nombre: 'Apagar', args: ['apagar'], explicacion: 'Apagado ordenado; si alguna no responde, se fuerza al acabar la espera.', peligro: true },
  { id: 'encender', nombre: 'Encender', args: ['encender'], explicacion: 'Enciende las que estén apagadas.' },
];

export default function Energia() {
  const { ajustes, objetivo, valido, onChange } = useObjetivo();
  const [espera, setEspera] = useState(120);
  return (
    <>
      <section class="panel">
        <div class="panel-cabecera">
          <h2>¿Qué máquinas?</h2>
          <p>Al acabar la sesión, apagar la clase libera memoria y procesador para las demás.</p>
        </div>
        <SelectorObjetivo realm={ajustes.realm} onChange={onChange} conFiltro />
        <details class="mas-opciones">
          <summary>Más opciones</summary>
        <div class="campos" style="margin-top:12px">
          <div class="campo">
            <label for="espera">Espera antes de forzar el apagado (segundos)</label>
            <input id="espera" type="number" min="10" value={espera} onInput={(e) => setEspera(Number(e.currentTarget.value) || 120)} />
            <small>Las máquinas que no tengan agente o no respondan se apagan a la fuerza pasado este tiempo.</small>
          </div>
        </div>
        </details>
      </section>
      {valido && (
        <section class="panel">
          <VisorScript script={scriptEnergia({ ...objetivo, espera })} fichero={`energia-${objetivo.clase}.sh`} variantes={VARIANTES} />
        </section>
      )}
    </>
  );
}
