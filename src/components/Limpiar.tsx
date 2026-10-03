import { useEffect, useState } from 'preact/hooks';
import Icono from './Icono';
import SelectorObjetivo from './SelectorObjetivo';
import VisorScript, { type Variante } from './VisorScript';
import { useObjetivo } from './useObjetivo';
import { scriptLimpiar } from '../lib/proxmox/limpiar';

const VARIANTES: Variante[] = [
  { id: 'simular', nombre: 'Simular', args: ['--dry-run'], explicacion: 'Lista las máquinas que se destruirían.' },
  { id: 'limpiar', nombre: 'Destruir', args: [], explicacion: 'Pide escribir el nombre de la clase antes de destruir.', peligro: true },
];

export default function Limpiar() {
  const { ajustes, objetivo, valido, onChange } = useObjetivo();
  const [entendido, setEntendido] = useState(false);
  useEffect(() => setEntendido(false), [objetivo.clase, objetivo.filtro, objetivo.etiqueta]);
  return (
    <>
      <section class="panel">
        <div class="panel-cabecera">
          <h2>¿Qué práctica quieres limpiar?</h2>
          <p>Destruye en los pools de la clase las máquinas de una práctica ya terminada. No toca usuarios, pools ni el resto de máquinas.</p>
        </div>
        <SelectorObjetivo realm={ajustes.realm} onChange={onChange} conFiltro filtroObligatorio ayudaFiltro="Por ejemplo, practica3. Es obligatorio indicar un nombre o una etiqueta." />
        <div class="aviso aviso-peligro" style="margin-top:20px">
          <Icono nombre="alerta" />
          <label class="casilla" style="font-weight:600">
            <input type="checkbox" checked={entendido} onChange={(e) => setEntendido(e.currentTarget.checked)} />
            <span>Entiendo que las máquinas que coincidan se destruirán con sus discos y no se puede deshacer.</span>
          </label>
        </div>
      </section>
      {valido && entendido && (
        <section class="panel">
          <VisorScript script={scriptLimpiar(objetivo)} fichero={`limpiar-${objetivo.clase}.sh`} variantes={VARIANTES} />
        </section>
      )}
    </>
  );
}
