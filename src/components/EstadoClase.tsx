import SelectorObjetivo from './SelectorObjetivo';
import VisorScript, { type Variante } from './VisorScript';
import { useObjetivo } from './useObjetivo';
import { scriptEstado } from '../lib/proxmox/estado';

const VARIANTES: Variante[] = [{ id: 'ver', nombre: 'Ver estado', args: [], explicacion: 'Solo lee: no cambia nada.' }];

export default function EstadoClase() {
  const { ajustes, objetivo, valido, onChange } = useObjetivo();
  return (
    <>
      <section class="panel">
        <div class="panel-cabecera">
          <h2>¿Qué clase?</h2>
          <p>Por alumno: sus máquinas, cuántas están encendidas, la memoria y los procesadores que usan y el disco frente a su cuota.</p>
        </div>
        <SelectorObjetivo realm={ajustes.realm} onChange={onChange} />
      </section>
      {valido && (
        <section class="panel">
          <VisorScript script={scriptEstado({ ...objetivo, realm: ajustes.realm })} fichero={`estado-${objetivo.clase}.sh`} variantes={VARIANTES} />
        </section>
      )}
    </>
  );
}
