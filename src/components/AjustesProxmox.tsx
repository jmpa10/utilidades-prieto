import { useEffect, useState } from 'preact/hooks';
import Icono from './Icono';
import { AJUSTES_POR_DEFECTO, guardarAjustes, leerAjustes, type Ajustes } from '../lib/ajustes';

export default function AjustesProxmox() {
  const [a, setA] = useState<Ajustes>(AJUSTES_POR_DEFECTO);
  const [estado, setEstado] = useState<'' | 'guardado' | 'error'>('');
  useEffect(() => setA(leerAjustes()), []);

  const set = (parcial: Partial<Ajustes>) => {
    setA({ ...a, ...parcial });
    setEstado('');
  };

  function guardar(e: Event) {
    e.preventDefault();
    setEstado(guardarAjustes(a) ? 'guardado' : 'error');
  }

  return (
    <form class="panel" onSubmit={guardar}>
      <div class="panel-cabecera">
        <h2>Valores por defecto</h2>
        <p>Se guardan solo en este navegador y se usan al crear usuarios. Siempre puedes cambiarlos en cada script.</p>
      </div>
      <div class="campos">
        <div class="campo">
          <label for="s-url">Dirección del Proxmox</label>
          <input id="s-url" type="url" placeholder="https://proxmox.centro.es:8006" value={a.urlProxmox} onInput={(e) => set({ urlProxmox: e.currentTarget.value.trim() })} />
          <small>Aparece en las papeletas y en el CSV.</small>
        </div>
        <div class="campo">
          <label for="s-centro">Nombre del centro</label>
          <input id="s-centro" type="text" value={a.centro} onInput={(e) => set({ centro: e.currentTarget.value })} />
        </div>
        <div class="campo">
          <label for="s-rol">Rol del alumno</label>
          <input id="s-rol" type="text" value={a.rol} onInput={(e) => set({ rol: e.currentTarget.value.trim() })} />
          <small>El que ya habéis creado en Proxmox.</small>
        </div>
        <div class="campo">
          <label for="s-realm">Realm</label>
          <input id="s-realm" type="text" value={a.realm} onInput={(e) => set({ realm: e.currentTarget.value.trim() })} />
          <small><code>pve</code> son los usuarios propios de Proxmox.</small>
        </div>
        <div class="campo">
          <label for="s-storage">Storage de discos</label>
          <input id="s-storage" type="text" value={a.storage} onInput={(e) => set({ storage: e.currentTarget.value.trim() })} />
          <small>Donde se crean los discos de las VMs. Se añade al pool de cada alumno.</small>
        </div>
        <div class="campo">
          <label for="s-isos">Storage de ISOs</label>
          <input id="s-isos" type="text" value={a.storageIsos} onInput={(e) => set({ storageIsos: e.currentTarget.value.trim() })} />
          <small>Los alumnos pueden usarlas; los profesores, subirlas.</small>
        </div>
        <div class="campo">
          <label for="s-plantillas">Pool de plantillas</label>
          <input id="s-plantillas" type="text" placeholder="Vacío: no se usa" value={a.poolPlantillas} onInput={(e) => set({ poolPlantillas: e.currentTarget.value.trim() })} />
          <small>Plantillas que los alumnos pueden clonar en su pool.</small>
        </div>
        <div class="campo">
          <label for="s-rolesprof">Roles del profesor sobre la clase</label>
          <input id="s-rolesprof" type="text" value={a.rolesProfesor} onInput={(e) => set({ rolesProfesor: e.currentTarget.value.replace(/\s+/g, '') })} />
          <small>Separados por comas. Ven y gestionan las máquinas de todos sus alumnos.</small>
        </div>
        <div class="campo">
          <label for="s-cuota">Espacio por alumno (GB)</label>
          <input id="s-cuota" type="number" min="1" value={a.cuotaGB} onInput={(e) => set({ cuotaGB: Number(e.currentTarget.value) })} />
        </div>
        <div class="campo">
          <label for="s-pass">Tipo de contraseña</label>
          <select id="s-pass" value={a.estiloPassword} onChange={(e) => set({ estiloPassword: e.currentTarget.value as Ajustes['estiloPassword'] })}>
            <option value="legible">Fácil de dictar (Lince-Verde-472)</option>
            <option value="fuerte">Aleatoria de 14 caracteres</option>
          </select>
        </div>
      </div>
      <div class="acciones">
        <button type="button" class="btn btn-texto" onClick={() => set({ ...AJUSTES_POR_DEFECTO, bridges: a.bridges })}>Restablecer valores</button>
        <div class="acciones-grupo" style="align-items:center">
          <span role="status" style="font-weight:700;color:var(--verde-texto)">
            {estado === 'guardado' && 'Ajustes guardados'}
            {estado === 'error' && <span style="color:var(--rojo)">Este navegador no permite guardarlos</span>}
          </span>
          <button type="submit" class="btn btn-primario"><Icono nombre="check" tam={18} />Guardar ajustes</button>
        </div>
      </div>
    </form>
  );
}
