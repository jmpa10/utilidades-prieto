import { useEffect, useState } from 'preact/hooks';
import SelectorObjetivo from './SelectorObjetivo';
import VisorScript, { type Variante } from './VisorScript';
import { useObjetivo } from './useObjetivo';
import Icono from './Icono';
import ProyectoTerraform, { SelectorMetodo, useMetodo } from './Terraform';
import { scriptRepartir, validarPrefijo } from '../lib/proxmox/repartir';
import { ficheroRepartir, tfRepartir } from '../lib/terraform/repartir';

const VARIANTES: Variante[] = [
  { id: 'simular', nombre: 'Simular', args: ['--dry-run'], explicacion: 'Muestra qué clones haría y a quién.' },
  { id: 'repartir', nombre: 'Repartir', args: [], explicacion: 'Crea un clon completo en el pool de cada alumno. Salta a quien ya lo tenga.' },
];

export default function Repartir() {
  const { ajustes, objetivo, valido, onChange } = useObjetivo();
  const [plantilla, setPlantilla] = useState('');
  const [prefijo, setPrefijo] = useState('');
  const [storage, setStorage] = useState('');
  const [encender, setEncender] = useState(false);
  const [metodo, setMetodo] = useMetodo();
  useEffect(() => setStorage(ajustes.storage), [ajustes]);
  const errorPrefijo = prefijo ? validarPrefijo(prefijo) : null;
  const listo = valido && !!plantilla.trim() && !!prefijo && !errorPrefijo;

  return (
    <>
      <section class="panel">
        <div class="panel-cabecera">
          <h2>¿Qué plantilla y a quién?</h2>
          <p>Cada alumno recibe en su pool una copia completa de la plantilla, lista para empezar la práctica.</p>
        </div>
        <div class="campos" style="margin-bottom:18px">
          <div class="campo">
            <label for="plantilla">Plantilla</label>
            <input id="plantilla" type="text" placeholder="debian-12-base o 9000" value={plantilla} onInput={(e) => setPlantilla(e.currentTarget.value.trim())} />
            <small>Su nombre o su número (VMID). Debe estar convertida en plantilla.</small>
          </div>
          <div class="campo">
            <label for="prefijo">Nombre de cada copia</label>
            <input id="prefijo" type="text" placeholder="debian" value={prefijo} aria-invalid={!!errorPrefijo} onInput={(e) => setPrefijo(e.currentTarget.value.trim().toLowerCase())} />
            {errorPrefijo ? <small class="error">{errorPrefijo}</small> : <small>Quedará <code>{prefijo || 'debian'}-jperez</code>, <code>{prefijo || 'debian'}-mfuente</code>…</small>}
          </div>
          <div class="campo">
            <label for="rep-storage">Storage de los discos</label>
            <input id="rep-storage" type="text" value={storage} onInput={(e) => setStorage(e.currentTarget.value.trim())} />
            <small>Vacío: el mismo de la plantilla.</small>
          </div>
          <div class="campo" style="justify-content:center">
            <label class="casilla">
              <input type="checkbox" checked={encender} onChange={(e) => setEncender(e.currentTarget.checked)} />
              <span>Encenderlas al terminar<small>Útil si la práctica empieza ya.</small></span>
            </label>
          </div>
        </div>
        <SelectorObjetivo realm={ajustes.realm} onChange={onChange} />
      </section>
      {listo && (
        <section class="panel">
          <div style="margin-bottom:20px">
            <SelectorMetodo metodo={metodo} onChange={setMetodo} />
          </div>
          {metodo === 'script' ? (
            <VisorScript
              script={scriptRepartir({ clase: objetivo.clase, bases: objetivo.bases, plantilla, prefijo, storage, encender })}
              fichero={`repartir-${prefijo}-${objetivo.clase}.sh`}
              variantes={VARIANTES}
            />
          ) : (
            <ProyectoTerraform
              ficheros={{ [ficheroRepartir(prefijo)]: tfRepartir({ clase: objetivo.clase, bases: objetivo.bases, plantilla, prefijo, storage, encender }) }}
              comandos={`# Copia ${ficheroRepartir(prefijo)} en la carpeta terraform-${objetivo.clase}\ncd terraform-${objetivo.clase}\nterraform plan    # revisa qué copias va a crear\nterraform apply`}
            >
              <div class="aviso">
                <Icono nombre="info" />
                <span>
                  Solo para clases creadas con Terraform: el fichero se añade a su proyecto y usa su lista de alumnos.
                  {objetivo.bases.length === 0 && ' Quien se dé de alta después también recibirá su copia.'} Solo plantillas de máquina virtual, no de contenedor.
                  Para retirar las copias, borra el fichero y aplica.
                </span>
              </div>
            </ProyectoTerraform>
          )}
        </section>
      )}
    </>
  );
}
