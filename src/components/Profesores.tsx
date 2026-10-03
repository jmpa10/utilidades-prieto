import { useEffect, useState } from 'preact/hooks';
import VisorScript, { type Variante } from './VisorScript';
import { AJUSTES_POR_DEFECTO, leerAjustes, type Ajustes } from '../lib/ajustes';
import { claseId, validarIdentificador } from '../lib/names';
import { listaProfesores, profesorValido } from '../lib/profesores';
import { scriptProfesores } from '../lib/proxmox/profesores';

const VARIANTES: Variante[] = [
  { id: 'anadir', nombre: 'Añadir', args: ['anadir'], explicacion: 'Verán y gestionarán las máquinas de toda la clase y podrán subir ISOs.' },
  { id: 'quitar', nombre: 'Quitar', args: ['quitar'], explicacion: 'Dejan de ver la clase. Conservan el permiso de subir ISOs.', peligro: true },
];

export default function Profesores() {
  const [ajustes, setAjustes] = useState<Ajustes>(AJUSTES_POR_DEFECTO);
  const [claseNombre, setClaseNombre] = useState('');
  const [texto, setTexto] = useState('');
  useEffect(() => setAjustes(leerAjustes()), []);
  const clase = claseId(claseNombre);
  const errorClase = claseNombre ? validarIdentificador(clase) : null;
  const profesores = listaProfesores(texto, ajustes.realm);
  const malos = profesores.filter((p) => !profesorValido(p));
  const listo = !!clase && !errorClase && profesores.length > 0 && !malos.length;

  return (
    <>
      <section class="panel">
        <div class="panel-cabecera">
          <h2>¿Qué clase y qué profesores?</h2>
          <p>Para cambios de horario o sustituciones, sin tocar a los alumnos.</p>
        </div>
        <div class="campos">
          <div class="campo">
            <label for="pr-clase">Clase</label>
            <input id="pr-clase" type="text" placeholder="2º ASIR" value={claseNombre} aria-invalid={!!errorClase} onInput={(e) => setClaseNombre(e.currentTarget.value)} />
            {errorClase ? <small class="error">{errorClase}</small> : <small>Debe estar creada.</small>}
          </div>
          <div class="campo">
            <label for="pr-profes">Profesores</label>
            <input id="pr-profes" type="text" placeholder="profe1@pve, profe2@pve" value={texto} onInput={(e) => setTexto(e.currentTarget.value)} />
            {malos.length ? <small class="error">No parecen usuarios: {malos.join(', ')}</small> : <small>Usuarios que ya existen en Proxmox.</small>}
          </div>
        </div>
      </section>
      {listo && (
        <section class="panel">
          <VisorScript
            script={scriptProfesores({ clase, profesores, rolesProfesor: ajustes.rolesProfesor, storageIsos: ajustes.storageIsos })}
            fichero={`profesores-${clase}.sh`}
            variantes={VARIANTES}
          />
        </section>
      )}
    </>
  );
}
