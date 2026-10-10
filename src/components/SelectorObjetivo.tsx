import { useEffect, useMemo, useState } from 'preact/hooks';
import Icono from './Icono';
import { claseId, usuarioCompleto, validarIdentificador } from '../lib/names';
import { leerResumen } from '../lib/proxmox/resumen';
import type { Objetivo } from '../lib/proxmox/objetivo';

interface Props {
  realm: string;
  onChange: (objetivo: Objetivo, valido: boolean) => void;
  /** Muestra el filtro por nombre o etiqueta. */
  conFiltro?: boolean;
  /** El filtro es obligatorio (p. ej. para borrar). */
  filtroObligatorio?: boolean;
  /** Texto de ayuda del filtro. */
  ayudaFiltro?: string;
}

/** «jperez, mfuente-asir2@pve» o un resumen TXT → bases de usuario de esa clase. */
export function basesDesdeTexto(texto: string, clase: string): string[] {
  const resumen = leerResumen(texto);
  const ids = resumen ? resumen.usuarios.map((u) => u.userid) : texto.split(/[\s,;]+/).filter(Boolean);
  return [...new Set(ids.map((id) => {
    const u = id.toLowerCase().replace(/@.*$/, '');
    return clase && u.endsWith(`-${clase}`) ? u.slice(0, -clase.length - 1) : u;
  }))];
}

export default function SelectorObjetivo({ realm, onChange, conFiltro = false, filtroObligatorio = false, ayudaFiltro }: Props) {
  const [claseNombre, setClaseNombre] = useState('');
  const [alcance, setAlcance] = useState<'clase' | 'alumnos'>('clase');
  const [alumnos, setAlumnos] = useState('');
  const [filtro, setFiltro] = useState('');
  const [etiqueta, setEtiqueta] = useState('');

  const clase = claseId(claseNombre);
  const errorClase = claseNombre ? validarIdentificador(clase) : null;
  const resumen = useMemo(() => leerResumen(alumnos), [alumnos]);
  useEffect(() => {
    if (resumen?.clase && !claseNombre) setClaseNombre(resumen.clase);
  }, [resumen]);

  const bases = alcance === 'alumnos' ? basesDesdeTexto(alumnos, clase) : [];
  const malos = bases.filter((b) => validarIdentificador(usuarioCompleto(b, clase)));
  const sinFiltro = filtroObligatorio && !filtro.trim() && !etiqueta.trim();
  const valido = !!clase && !errorClase && (alcance === 'clase' || (bases.length > 0 && !malos.length)) && !sinFiltro;

  useEffect(() => {
    onChange({ clase, bases, filtro: filtro.trim(), etiqueta: etiqueta.trim() }, valido);
  }, [clase, alcance, alumnos, filtro, etiqueta, valido]);

  async function cargar(f?: File | null) {
    if (f) setAlumnos(await f.text());
  }

  return (
    <div class="selector">
      <div class="campos">
        <div class="campo">
          <label for="obj-clase">Clase</label>
          <input id="obj-clase" type="text" placeholder="2º ASIR" value={claseNombre} aria-invalid={!!errorClase} onInput={(e) => setClaseNombre(e.currentTarget.value)} />
          {errorClase ? <small class="error">{errorClase}</small> : <small>{clase ? <>Pools <code>{clase}/…</code></> : 'Por ejemplo, 2º ASIR'}</small>}
        </div>
        <div class="campo">
          <span class="campo-etiqueta" id="obj-alcance">¿A quién?</span>
          <div class="segmentos" role="radiogroup" aria-labelledby="obj-alcance">
            <button type="button" role="radio" class="segmento" aria-checked={alcance === 'clase'} aria-selected={alcance === 'clase'} onClick={() => setAlcance('clase')}>
              <Icono nombre="usuarios" tam={16} /> Toda la clase
            </button>
            <button type="button" role="radio" class="segmento" aria-checked={alcance === 'alumnos'} aria-selected={alcance === 'alumnos'} onClick={() => setAlcance('alumnos')}>
              <Icono nombre="usuarioMas" tam={16} /> Algunos alumnos
            </button>
          </div>
        </div>
      </div>

      {alcance === 'alumnos' && (
        <div class="campo" style="margin-top:18px">
          <label for="obj-alumnos">Alumnos</label>
          <textarea id="obj-alumnos" rows={3} placeholder="jperez, mfuente-asir2" value={alumnos} onInput={(e) => setAlumnos(e.currentTarget.value)} spellcheck={false} style="min-height:90px" />
          <small>
            Usuarios separados por comas o espacios, con o sin la clase.{' '}
            <label style="cursor:pointer;text-decoration:underline">
              O carga el resumen .txt de la clase
              <input type="file" accept=".txt,text/plain" hidden onChange={(e) => cargar(e.currentTarget.files?.[0])} />
            </label>
            {bases.length > 0 && clase && <> · {bases.length}: {bases.slice(0, 5).map((b) => usuarioCompleto(b, clase)).join(', ')}{bases.length > 5 && '…'}</>}
          </small>
          {malos.length > 0 && <small class="error">No parecen usuarios válidos: {malos.join(', ')}</small>}
        </div>
      )}

      {conFiltro && (filtroObligatorio ? (
        <div class="campos" style="margin-top:18px">
          <div class="campo">
            <label for="obj-filtro">Máquinas cuyo nombre contenga{filtroObligatorio ? '' : ' (opcional)'}</label>
            <input id="obj-filtro" type="text" placeholder="practica3" value={filtro} onInput={(e) => setFiltro(e.currentTarget.value)} />
            <small>{ayudaFiltro ?? 'Vacío: todas las máquinas de sus pools.'}</small>
          </div>
          <div class="campo">
            <label for="obj-etiqueta">O con la etiqueta (opcional)</label>
            <input id="obj-etiqueta" type="text" placeholder="practica3" value={etiqueta} onInput={(e) => setEtiqueta(e.currentTarget.value)} />
            <small>Las etiquetas (tags) que se ponen a las máquinas en Proxmox.</small>
          </div>
        </div>
      ) : (
        <details class="mas-opciones" open={!!(filtro || etiqueta)}>
          <summary>Solo algunas máquinas (por nombre o etiqueta)</summary>
        <div class="campos" style="margin-top:18px">
          <div class="campo">
            <label for="obj-filtro">Máquinas cuyo nombre contenga{filtroObligatorio ? '' : ' (opcional)'}</label>
            <input id="obj-filtro" type="text" placeholder="practica3" value={filtro} onInput={(e) => setFiltro(e.currentTarget.value)} />
            <small>{ayudaFiltro ?? 'Vacío: todas las máquinas de sus pools.'}</small>
          </div>
          <div class="campo">
            <label for="obj-etiqueta">O con la etiqueta (opcional)</label>
            <input id="obj-etiqueta" type="text" placeholder="practica3" value={etiqueta} onInput={(e) => setEtiqueta(e.currentTarget.value)} />
            <small>Las etiquetas (tags) que se ponen a las máquinas en Proxmox.</small>
          </div>
        </div>
        </details>
      ))}
      {sinFiltro && <p class="error" style="margin-top:10px;font-weight:700;color:var(--rojo);font-size:.875rem">Indica un nombre o una etiqueta: esta utilidad no se aplica a todas las máquinas.</p>}
    </div>
  );
}
