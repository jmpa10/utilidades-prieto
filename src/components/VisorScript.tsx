import { useMemo, useState } from 'preact/hooks';
import Icono from './Icono';
import { resaltarBash } from '../lib/resaltado';
import { descargar } from '../lib/ajustes';

export default function VisorScript({ script, fichero }: { script: string; fichero: string }) {
  const [copiado, setCopiado] = useState(false);
  const html = useMemo(() => resaltarBash(script), [script]);
  const lineas = script.split('\n').length;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(script);
    } catch {
      const t = Object.assign(document.createElement('textarea'), { value: script });
      document.body.append(t);
      t.select();
      document.execCommand('copy');
      t.remove();
    }
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  return (
    <div class="visor">
      <div class="visor-barra">
        <span class="mono">{fichero} <span style="opacity:.6">({lineas} líneas)</span></span>
        <div class="acciones-grupo">
          <button type="button" class="btn btn-pequeno" onClick={copiar} aria-live="polite">
            <Icono nombre={copiado ? 'check' : 'copiar'} tam={16} />
            {copiado ? 'Copiado' : 'Copiar'}
          </button>
          <button type="button" class="btn btn-pequeno btn-primario" onClick={() => descargar(fichero, script, 'text/x-shellscript')}>
            <Icono nombre="descargar" tam={16} />
            Descargar
          </button>
        </div>
      </div>
      <pre tabIndex={0} aria-label={`Contenido de ${fichero}`}>
        <code dangerouslySetInnerHTML={{ __html: html }} />
      </pre>
    </div>
  );
}

export function ComoEjecutar({ fichero, conPasswords = false, destructivo = false }: { fichero: string; conPasswords?: boolean; destructivo?: boolean }) {
  return (
    <ol class="pasos-ejecucion">
      <li>Descarga el script y cópialo al nodo: <code>scp {fichero} root@nodo-proxmox:</code></li>
      <li>Haz primero una simulación, que no cambia nada: <code>bash {fichero} --dry-run</code></li>
      <li>
        Si todo cuadra, ejecútalo de verdad: <code>bash {fichero}</code>
        {destructivo && <> (te pedirá que escribas el nombre para confirmar)</>}
      </li>
      {conPasswords && (
        <li>Bórralo al terminar, porque lleva las contraseñas: <code>shred -u {fichero}</code></li>
      )}
    </ol>
  );
}
