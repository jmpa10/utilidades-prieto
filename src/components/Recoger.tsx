import { useState } from 'preact/hooks';
import Icono from './Icono';
import SelectorObjetivo from './SelectorObjetivo';
import VisorScript, { type Variante } from './VisorScript';
import { useObjetivo } from './useObjetivo';
import { nombreEntrega, scriptRecoger } from '../lib/proxmox/recoger';
import { validarSnapshot } from '../lib/proxmox/objetivo';

const VARIANTES: Variante[] = [
  { id: 'simular', nombre: 'Simular', args: ['--dry-run'], explicacion: 'Muestra qué recogería y quién no tiene máquinas que coincidan.' },
  { id: 'recoger', nombre: 'Recoger', args: [], explicacion: 'Hace el snapshot de entrega. Se puede repetir: no duplica.' },
];

export default function Recoger() {
  const { ajustes, objetivo, valido, onChange } = useObjetivo();
  const [practica, setPractica] = useState('');
  const error = practica ? validarSnapshot(nombreEntrega(practica)) : null;
  return (
    <>
      <section class="panel">
        <div class="panel-cabecera">
          <h2>¿Qué práctica recoges?</h2>
          <p>Se guarda un snapshot «entrega» en cada máquina de la práctica: queda congelado lo que había en ese momento para corregirlo.</p>
        </div>
        <div class="campos" style="margin-bottom:18px">
          <div class="campo">
            <label for="practica">Práctica</label>
            <input id="practica" type="text" placeholder="practica3" value={practica} aria-invalid={!!error} onInput={(e) => setPractica(e.currentTarget.value.trim())} />
            {error ? <small class="error">{error}</small> : <small>El snapshot se llamará <code>{nombreEntrega(practica || 'practica3')}</code>.</small>}
          </div>
        </div>
        <SelectorObjetivo realm={ajustes.realm} onChange={onChange} conFiltro ayudaFiltro="Por ejemplo, el nombre de la práctica. Vacío: todas sus máquinas." />
      </section>
      {valido && practica && !error && (
        <section class="panel">
          <div class="aviso" style="margin-bottom:16px">
            <Icono nombre="info" />
            <span>
              El alumno podría borrar el snapshot de entrega, porque su rol le deja gestionar snapshots. Para corregir con garantías, recoge justo al acabar
              y revisa en <a href="/proxmox/snapshots/">Snapshots</a> que siguen ahí.
            </span>
          </div>
          <VisorScript script={scriptRecoger({ ...objetivo, practica })} fichero={`recoger-${practica}-${objetivo.clase}.sh`} variantes={VARIANTES} />
        </section>
      )}
    </>
  );
}
