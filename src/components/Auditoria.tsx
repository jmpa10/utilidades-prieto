import { useState } from 'preact/hooks';
import VisorScript, { type Variante } from './VisorScript';
import { claseId } from '../lib/names';
import { scriptAuditoria } from '../lib/proxmox/audit';

export default function Auditoria() {
  const [claseNombre, setClaseNombre] = useState('');
  const [umbral, setUmbral] = useState(90);
  const [correo, setCorreo] = useState('');
  const clase = claseId(claseNombre);
  const fichero = `auditoria-${clase || 'cuotas'}.sh`;
  const mail = correo.trim() ? ['--mail', correo.trim()] : [];

  const variantes: Variante[] = [
    { id: 'informe', nombre: 'Ver informe', args: [], explicacion: 'Muestra ahora mismo el uso de cada pool.' },
    {
      id: 'cron',
      nombre: 'Informe diario',
      args: ['--instalar-cron', ...mail],
      explicacion: `Lo instala en el nodo para que se ejecute cada día a las 7:00${mail.length ? ' y avise por correo' : ''}.`,
    },
    { id: 'quitar', nombre: 'Quitar informe diario', args: ['--desinstalar-cron'], explicacion: 'Elimina el informe diario del nodo.' },
  ];

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
          <div class="campo">
            <label for="a-correo">Correo para avisos</label>
            <input id="a-correo" type="text" inputMode="email" placeholder="Opcional" value={correo} onInput={(e) => setCorreo(e.currentTarget.value)} />
            <small>Solo para el informe diario. El nodo debe tener el correo configurado.</small>
          </div>
        </div>
      </section>
      <section class="panel">
        <div class="panel-cabecera">
          <h2>Script de auditoría</h2>
          <p>Solo lee: no para ni borra nada. El informe diario se guarda en <code>/var/log/utilidades-prieto/</code>.</p>
        </div>
        <VisorScript script={scriptAuditoria({ clase, umbralAviso: umbral })} fichero={fichero} variantes={variantes} />
      </section>
    </>
  );
}
