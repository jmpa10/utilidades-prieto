import { useState } from 'preact/hooks';
import VisorScript from './VisorScript';
import { claseId } from '../lib/names';
import { scriptAuditoria } from '../lib/proxmox/audit';

export default function Auditoria() {
  const [claseNombre, setClaseNombre] = useState('');
  const [umbral, setUmbral] = useState(90);
  const clase = claseId(claseNombre);
  const fichero = `auditoria-${clase || 'cuotas'}.sh`;

  return (
    <>
      <section class="panel">
        <div class="panel-cabecera">
          <h2>¿Qué quieres revisar?</h2>
          <p>Déjalo vacío para revisar todas las clases a la vez.</p>
        </div>
        <div class="campos">
          <div class="campo">
            <label for="a-clase">Clase</label>
            <input id="a-clase" type="text" placeholder="Todas" value={claseNombre} onInput={(e) => setClaseNombre(e.currentTarget.value)} />
            <small>{clase ? <>Pools <code>{clase}/…</code></> : 'Todos los pools que tengan cuota'}</small>
          </div>
          <div class="campo">
            <label for="a-umbral">Avisar a partir del (%)</label>
            <input id="a-umbral" type="number" min="1" max="100" value={umbral} onInput={(e) => setUmbral(Number(e.currentTarget.value) || 90)} />
            <small>Por encima de este uso, el pool aparece como «cerca».</small>
          </div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-cabecera">
          <h2>Script de auditoría</h2>
          <p>Solo lee: no para ni borra nada.</p>
        </div>
        <VisorScript script={scriptAuditoria({ clase, umbralAviso: umbral })} fichero={fichero} />
        <h3 style="margin:24px 0 12px">Cómo usarlo</h3>
        <ol class="pasos-ejecucion">
          <li>Informe en el momento: <code>bash {fichero}</code></li>
          <li>Informe diario a las 7:00 en <code>/var/log/utilidades-prieto/</code>: <code>bash {fichero} --instalar-cron</code></li>
          <li>Con aviso por correo cuando alguien se pase: <code>bash {fichero} --instalar-cron --mail tu@correo.es</code> (el nodo debe tener el correo configurado)</li>
          <li>Para quitarlo: <code>bash {fichero} --desinstalar-cron</code></li>
        </ol>
      </section>
    </>
  );
}
