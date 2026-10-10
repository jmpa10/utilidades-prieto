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

/**
 * Lo importante primero: elegir qué hacer y copiar el bloque para pegar en la terminal.
 * El código queda plegado para quien quiera revisarlo o descargarlo como fichero.
 */
export default function VisorScript({ script, fichero, variantes, conPasswords = false }: Props) {
  const [varianteId, setVarianteId] = useState(variantes[0].id);
  const [copiado, setCopiado] = useState(false);
  const variante = variantes.find((v) => v.id === varianteId) ?? variantes[0];

  const bloque = useMemo(() => paraPegar(script, { args: variante.args, autoborrar: conPasswords }), [script, variante, conPasswords]);
  const html = useMemo(() => resaltarBash(script), [script]);
  const lineas = script.split('\n').length;

  async function copiar() {
    await alPortapapeles(bloque);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 2200);
  }

  return (
    <div class="visor-bloque">
      {variantes.length > 1 && (
        <div class="variantes" role="radiogroup" aria-label="Qué hacer">
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

      <div class="copiar-bloque">
        <button type="button" class={`btn ${variante.peligro ? 'btn-peligro' : 'btn-primario'} btn-grande`} onClick={copiar} aria-live="polite">
          <Icono nombre={copiado ? 'check' : 'copiar'} tam={20} />
          {copiado ? 'Copiado: pégalo en la terminal' : `Copiar «${variante.nombre}»`}
        </button>
        <p>
          Pégalo en la <strong>Shell</strong> de un nodo (en la web de Proxmox, selecciona el nodo y pulsa Shell) o por SSH como root, y pulsa Intro.
          {variantes[0].id === 'simular' && variante.id === 'simular' && ' Si todo cuadra, elige la otra opción y pega de nuevo.'}
        </p>
      </div>

      <details class="ver-script">
        <summary>Ver el script ({lineas} líneas) o descargarlo</summary>
        <div class="visor">
          <div class="visor-barra">
            <span class="mono">{fichero}</span>
            <button type="button" class="btn btn-pequeno" onClick={() => descargar(fichero, script, 'text/x-shellscript')}>
              <Icono nombre="descargar" tam={16} />
              Descargar .sh
            </button>
          </div>
          <pre tabIndex={0} aria-label={`Contenido de ${fichero}`}>
            <code dangerouslySetInnerHTML={{ __html: html }} />
          </pre>
        </div>
        <p class="nota-fichero">
          Como fichero: cópialo al nodo y ejecútalo con <code>bash {fichero}{variante.args.length ? ` ${variante.args.join(' ')}` : ''}</code>
          {conPasswords && <>. Lleva contraseñas: bórralo después con <code>shred -u {fichero}</code></>}.
          El bloque para pegar no deja rastro: usa un fichero temporal que se borra y no se guarda en el historial.
        </p>
      </details>
    </div>
  );
}
