import { useMemo, useState } from 'preact/hooks';
import Icono from './Icono';
import { resaltarBash } from '../lib/resaltado';
import { descargar } from '../lib/ajustes';
import { paraPegar } from '../lib/pegar';

export interface Variante {
  id: string;
  nombre: string;
  args: string[];
  /** Qué ocurre al pegar esta variante. */
  explicacion: string;
  peligro?: boolean;
}

interface Props {
  script: string;
  fichero: string;
  variantes: Variante[];
  /** El script lleva contraseñas: al pegarlo se borra solo y avisa en la versión fichero. */
  conPasswords?: boolean;
}

async function alPortapapeles(texto: string) {
  try {
    await navigator.clipboard.writeText(texto);
  } catch {
    const t = Object.assign(document.createElement('textarea'), { value: texto });
    document.body.append(t);
    t.select();
    document.execCommand('copy');
    t.remove();
  }
}

export default function VisorScript({ script, fichero, variantes, conPasswords = false }: Props) {
  const [vista, setVista] = useState<'pegar' | 'fichero'>('pegar');
  const [varianteId, setVarianteId] = useState(variantes[0].id);
  const [copiado, setCopiado] = useState(false);
  const variante = variantes.find((v) => v.id === varianteId) ?? variantes[0];

  const texto = useMemo(
    () => (vista === 'pegar' ? paraPegar(script, { args: variante.args, autoborrar: conPasswords }) : script),
    [vista, script, variante, conPasswords],
  );
  const html = useMemo(() => resaltarBash(texto), [texto]);

  async function copiar() {
    await alPortapapeles(texto);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  }

  return (
    <div class="visor-bloque">
      <div class="segmentos" role="tablist" aria-label="Cómo quieres ejecutarlo">
        <button type="button" role="tab" class="segmento" aria-selected={vista === 'pegar'} onClick={() => setVista('pegar')}>
          <Icono nombre="terminal" tam={18} /> Pegar en la terminal
        </button>
        <button type="button" role="tab" class="segmento" aria-selected={vista === 'fichero'} onClick={() => setVista('fichero')}>
          <Icono nombre="fichero" tam={18} /> Fichero .sh
        </button>
      </div>

      {vista === 'pegar' && variantes.length > 1 && (
        <div class="variantes" role="radiogroup" aria-label="Qué hacer al pegar">
          {variantes.map((v) => (
            <label class={`variante${v.id === variante.id ? ' activa' : ''}${v.peligro ? ' peligro' : ''}`} key={v.id}>
              <input type="radio" name={`variante-${fichero}`} checked={v.id === variante.id} onChange={() => setVarianteId(v.id)} />
              <span>
                <strong>{v.nombre}</strong>
                <small>{v.explicacion}</small>
              </span>
            </label>
          ))}
        </div>
      )}

      <div class="visor">
        <div class="visor-barra">
          <span class="mono">
            {vista === 'pegar' ? `${variante.nombre}: copiar y pegar` : fichero}{' '}
            <span style="opacity:.6">({texto.split('\n').length} líneas)</span>
          </span>
          <div class="acciones-grupo">
            <button type="button" class={`btn btn-pequeno${vista === 'pegar' ? (variante.peligro ? ' btn-peligro' : ' btn-primario') : ''}`} onClick={copiar} aria-live="polite">
              <Icono nombre={copiado ? 'check' : 'copiar'} tam={16} />
              {copiado ? 'Copiado' : vista === 'pegar' ? 'Copiar para pegar' : 'Copiar'}
            </button>
            {vista === 'fichero' && (
              <button type="button" class="btn btn-pequeno btn-primario" onClick={() => descargar(fichero, script, 'text/x-shellscript')}>
                <Icono nombre="descargar" tam={16} />
                Descargar
              </button>
            )}
          </div>
        </div>
        <pre tabIndex={0} aria-label={vista === 'pegar' ? 'Bloque para pegar en la terminal' : `Contenido de ${fichero}`}>
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      </div>

      {vista === 'pegar' ? (
        <ol class="pasos-ejecucion">
          <li>
            Abre una terminal como <code>root</code> en un nodo: en la web de Proxmox, selecciona el nodo y pulsa <strong>Shell</strong>, o entra por SSH.
          </li>
          <li>Pega el bloque y pulsa Intro si no arranca solo.</li>
          {variantes[0].id === 'simular' && <li>Revisa lo que muestra y, si todo cuadra, vuelve aquí, elige «{variantes[variantes.length - 1].nombre}» y pega de nuevo.</li>}
          <li style="list-style:none;margin-left:-1.4em;font-size:.875rem;color:var(--tinta-tenue)">
            El bloque no deja rastro: se ejecuta desde un fichero temporal que se borra al terminar y no se guarda en el historial de la terminal.
          </li>
        </ol>
      ) : (
        <ol class="pasos-ejecucion">
          <li>Descarga el script y cópialo al nodo: <code>scp {fichero} root@nodo-proxmox:</code></li>
          {variantes.map((v) => (
            <li key={v.id}>
              {v.nombre}: <code>bash {fichero}{v.args.length ? ` ${v.args.join(' ')}` : ''}</code>
            </li>
          ))}
          {conPasswords && <li>Bórralo al terminar, porque lleva las contraseñas: <code>shred -u {fichero}</code></li>}
        </ol>
      )}
    </div>
  );
}
