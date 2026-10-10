import { useEffect, useMemo, useState } from 'preact/hooks';
import type { ComponentChildren } from 'preact';
import Icono from './Icono';
import { descargar, guardarAjustes, leerAjustes, type Ajustes } from '../lib/ajustes';
import { resaltarBash } from '../lib/resaltado';
import { crearZip } from '../lib/zip';

export type Metodo = Ajustes['metodo'];

/** Método preferido (scripts o Terraform), recordado en este navegador. */
export function useMetodo(): [Metodo, (m: Metodo) => void] {
  const [metodo, setMetodo] = useState<Metodo>('script');
  useEffect(() => setMetodo(leerAjustes().metodo), []);
  return [
    metodo,
    (m) => {
      setMetodo(m);
      guardarAjustes({ ...leerAjustes(), metodo: m });
    },
  ];
}

export function SelectorMetodo({ metodo, onChange }: { metodo: Metodo; onChange: (m: Metodo) => void }) {
  return (
    <div class="segmentos" role="tablist" aria-label="Cómo aplicarlo">
      <button type="button" role="tab" class="segmento" aria-selected={metodo === 'script'} onClick={() => onChange('script')}>
        <Icono nombre="terminal" tam={18} /> Terminal del nodo
      </button>
      <button type="button" role="tab" class="segmento" aria-selected={metodo === 'terraform'} onClick={() => onChange('terraform')}>
        <Icono nombre="fichero" tam={18} /> Terraform
      </button>
    </div>
  );
}

function VisorFichero({ nombre, contenido }: { nombre: string; contenido: string }) {
  const html = useMemo(() => resaltarBash(contenido), [contenido]);
  return (
    <details class="ver-script">
      <summary>{nombre} ({contenido.split('\n').length} líneas)</summary>
      <div class="visor">
        <div class="visor-barra">
          <span class="mono">{nombre}</span>
          <button type="button" class="btn btn-pequeno" onClick={() => descargar(nombre, contenido)}>
            <Icono nombre="descargar" tam={16} />
            Descargar
          </button>
        </div>
        <pre tabIndex={0} aria-label={`Contenido de ${nombre}`}>
          <code dangerouslySetInnerHTML={{ __html: html }} />
        </pre>
      </div>
    </details>
  );
}

interface Props {
  /** Ficheros del proyecto (nombre → contenido). */
  ficheros: Record<string, string>;
  /** Con carpeta se descarga todo en un .zip; sin ella, el único fichero tal cual. */
  carpeta?: string;
  /** Comandos que se ejecutan después, dentro de la carpeta del proyecto. */
  comandos: string;
  children?: ComponentChildren;
}

/** Descarga y revisión de un proyecto Terraform generado en el navegador. */
export default function ProyectoTerraform({ ficheros, carpeta, comandos, children }: Props) {
  const nombres = Object.keys(ficheros);
  const zip = carpeta ? `${carpeta}.zip` : null;
  const bajar = () =>
    zip ? descargar(zip, crearZip(ficheros, carpeta), 'application/zip') : descargar(nombres[0], ficheros[nombres[0]]);

  return (
    <div class="visor-bloque">
      {children}
      <div class="copiar-bloque">
        <button type="button" class="btn btn-primario btn-grande" onClick={bajar}>
          <Icono nombre="descargar" tam={20} />
          Descargar {zip ?? nombres[0]}
        </button>
        <p>Ejecútalo desde tu ordenador o una VM con Terraform instalado y acceso a la web de Proxmox (puerto 8006).</p>
      </div>
      <div class="visor">
        <div class="visor-barra"><span class="mono">Después</span></div>
        <pre tabIndex={0} aria-label="Comandos">
          <code dangerouslySetInnerHTML={{ __html: resaltarBash(comandos) }} />
        </pre>
      </div>
      {nombres.map((n) => <VisorFichero key={n} nombre={n} contenido={ficheros[n]} />)}
    </div>
  );
}
