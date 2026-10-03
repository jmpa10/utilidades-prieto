import { useState } from 'preact/hooks';
import SelectorObjetivo from './SelectorObjetivo';
import VisorScript, { type Variante } from './VisorScript';
import { useObjetivo } from './useObjetivo';
import { scriptSnapshots } from '../lib/proxmox/snapshots';
import { validarSnapshot } from '../lib/proxmox/objetivo';

const VARIANTES: Variante[] = [
  { id: 'ver', nombre: 'Ver', args: ['ver'], explicacion: 'Lista los snapshots de cada máquina.' },
  { id: 'crear', nombre: 'Crear', args: ['crear'], explicacion: 'Hace el snapshot en todas. Salta las que ya lo tienen.' },
  { id: 'volver', nombre: 'Volver a él', args: ['volver'], explicacion: 'Cada máquina pierde lo hecho desde entonces. Pide confirmación.', peligro: true },
  { id: 'borrar', nombre: 'Borrar', args: ['borrar'], explicacion: 'Elimina ese snapshot de todas. Pide confirmación.', peligro: true },
];

export default function Snapshots() {
  const { ajustes, objetivo, valido, onChange } = useObjetivo();
  const [nombre, setNombre] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const error = nombre ? validarSnapshot(nombre) : null;
  return (
    <>
      <section class="panel">
        <div class="panel-cabecera">
          <h2>¿De qué máquinas?</h2>
          <p>Antes de una práctica arriesgada, un snapshot permite volver atrás en un momento.</p>
        </div>
        <SelectorObjetivo realm={ajustes.realm} onChange={onChange} conFiltro />
        <div class="campos" style="margin-top:18px">
          <div class="campo">
            <label for="snap">Nombre del snapshot</label>
            <input id="snap" type="text" placeholder="antes-practica3" value={nombre} aria-invalid={!!error} onInput={(e) => setNombre(e.currentTarget.value.trim())} />
            {error ? <small class="error">{error}</small> : <small>Para «Ver» puedes dejarlo vacío.</small>}
          </div>
          <div class="campo">
            <label for="snap-desc">Descripción (opcional)</label>
            <input id="snap-desc" type="text" placeholder="Antes de configurar el firewall" value={descripcion} onInput={(e) => setDescripcion(e.currentTarget.value)} />
          </div>
        </div>
      </section>
      {valido && !error && (
        <section class="panel">
          {!nombre && <div class="aviso" style="margin-bottom:16px"><span>Sin nombre solo funciona «Ver».</span></div>}
          <VisorScript script={scriptSnapshots({ ...objetivo, nombre, descripcion })} fichero={`snapshots-${objetivo.clase}.sh`} variantes={VARIANTES} />
        </section>
      )}
    </>
  );
}
