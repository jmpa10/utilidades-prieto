import { useEffect, useMemo, useState } from 'preact/hooks';
import Icono from './Icono';
import VisorScript, { ComoEjecutar } from './VisorScript';
import { AJUSTES_POR_DEFECTO, leerAjustes } from '../lib/ajustes';
import { asignarBases, claseId, parsearTexto, poolDe, usuarioCompleto, validarIdentificador } from '../lib/names';
import { scriptBorrado, type ModoBorrado } from '../lib/proxmox/delete';
import { leerResumen } from '../lib/proxmox/resumen';

const MODOS: { id: ModoBorrado; nombre: string; icono: string }[] = [
  { id: 'clase', nombre: 'Toda una clase', icono: 'usuarios' },
  { id: 'lista', nombre: 'Desde el TXT', icono: 'fichero' },
  { id: 'usuario', nombre: 'Un usuario', icono: 'usuarioMas' },
];

export default function BorrarUsuarios() {
  const [realm, setRealm] = useState(AJUSTES_POR_DEFECTO.realm);
  const [modo, setModo] = useState<ModoBorrado>('clase');
  const [claseNombre, setClaseNombre] = useState('');
  const [texto, setTexto] = useState('');
  const [usuario, setUsuario] = useState('');
  const [entendido, setEntendido] = useState(false);
  const [generado, setGenerado] = useState(false);

  useEffect(() => setRealm(leerAjustes().realm), []);
  useEffect(() => setGenerado(false), [modo, claseNombre, texto, usuario, entendido]);

  const clase = claseId(claseNombre);
  const resumen = useMemo(() => (modo === 'lista' ? leerResumen(texto) : null), [modo, texto]);
  useEffect(() => {
    if (resumen?.clase && !claseNombre) setClaseNombre(resumen.clase);
  }, [resumen]);

  const bases = useMemo(() => {
    if (resumen) {
      // Resumen de Utilidades Prieto: usuarios exactos, aunque se editaran a mano al crearlos.
      return resumen.usuarios.map((u) => {
        const user = u.userid.replace(/@.*$/, '');
        return clase && user.endsWith(`-${clase}`) ? user.slice(0, -clase.length - 1) : user;
      });
    }
    if (modo === 'lista') return asignarBases(parsearTexto(texto)).map((b) => b.base);
    if (modo === 'usuario') {
      const u = usuario.trim().toLowerCase().replace(/@.*$/, '');
      return u ? [clase && u.endsWith(`-${clase}`) ? u.slice(0, -clase.length - 1) : u] : [];
    }
    return [];
  }, [modo, texto, usuario, clase, resumen]);

  const errorClase = claseNombre && validarIdentificador(clase);
  const errorUsuario = modo === 'usuario' && bases[0] ? validarIdentificador(usuarioCompleto(bases[0], clase)) : null;
  const listo = entendido && !errorClase && !errorUsuario && (modo === 'clase' ? !!clase : modo === 'lista' ? !!clase && bases.length > 0 : bases.length === 1);
  const fichero = `borrar-${modo === 'usuario' ? usuarioCompleto(bases[0] ?? 'usuario', clase) : clase}.sh`;

  async function leerFichero(f?: File | null) {
    if (f) setTexto(await f.text());
  }

  return (
    <>
      <div class="segmentos" role="tablist" aria-label="Qué borrar">
        {MODOS.map((m) => (
          <button type="button" role="tab" class="segmento" key={m.id} aria-selected={modo === m.id} onClick={() => setModo(m.id)}>
            <Icono nombre={m.icono} tam={18} /> {m.nombre}
          </button>
        ))}
      </div>

      <section class="panel">
        <div class="panel-cabecera">
          <h2>{modo === 'clase' ? '¿Qué clase quieres borrar?' : modo === 'lista' ? '¿A quién quieres borrar?' : '¿Qué usuario quieres borrar?'}</h2>
          <p>
            {modo === 'clase' && 'El script busca en el momento todos los pools y usuarios de la clase, así que no necesitas la lista.'}
            {modo === 'lista' && 'Carga el resumen .txt que descargaste al crear la clase. También vale la lista original de alumnos: se calculan los mismos usuarios.'}
            {modo === 'usuario' && 'Escribe el usuario tal como aparece en Proxmox, por ejemplo jperez-2asir.'}
          </p>
        </div>
        <div class="campos">
          <div class="campo">
            <label for="b-clase">Clase{modo === 'usuario' && ' (opcional)'}</label>
            <input id="b-clase" type="text" placeholder="2º ASIR" value={claseNombre} aria-invalid={!!errorClase} onInput={(e) => setClaseNombre(e.currentTarget.value)} />
            {errorClase ? <small class="error">{errorClase}</small> : <small>{clase ? <>Pools <code>{clase}/…</code> y usuarios <code>…-{clase}@{realm}</code></> : 'Por ejemplo, 2º ASIR'}</small>}
          </div>
          {modo === 'usuario' && (
            <div class="campo">
              <label for="b-usuario">Usuario</label>
              <input id="b-usuario" type="text" placeholder="jperez-2asir" value={usuario} aria-invalid={!!errorUsuario} onInput={(e) => setUsuario(e.currentTarget.value)} />
              {errorUsuario ? <small class="error">{errorUsuario}</small> : bases[0] ? <small>Pool <code>{poolDe(bases[0], clase)}</code></small> : <small>Sin la clase, se busca un pool con su mismo nombre.</small>}
            </div>
          )}
        </div>

        {modo === 'lista' && (
          <div class="campo" style="margin-top:20px">
            <label for="b-lista">Lista de alumnos</label>
            <textarea id="b-lista" rows={8} placeholder="Pérez García, Juan" value={texto} onInput={(e) => setTexto(e.currentTarget.value)} spellcheck={false} />
            <small>
              <label style="cursor:pointer;text-decoration:underline">
                Cargar el resumen o la lista (.txt)
                <input type="file" accept=".txt,.csv,text/plain" hidden onChange={(e) => leerFichero(e.currentTarget.files?.[0])} />
              </label>
              {resumen && <> · Resumen de Utilidades Prieto detectado</>}
              {bases.length > 0 && clase && <> · {bases.length} usuarios: {bases.slice(0, 6).map((b) => usuarioCompleto(b, clase)).join(', ')}{bases.length > 6 && '…'}</>}
            </small>
          </div>
        )}

        <div class="aviso aviso-peligro" style="margin-top:24px">
          <Icono nombre="alerta" />
          <label class="casilla" style="font-weight:600">
            <input type="checkbox" checked={entendido} onChange={(e) => setEntendido(e.currentTarget.checked)} />
            <span>
              Entiendo que se pararán y destruirán todas las máquinas virtuales y contenedores de estos pools, junto con sus discos. No se puede deshacer.
            </span>
          </label>
        </div>

        <div class="acciones">
          <span />
          <button type="button" class="btn btn-peligro" disabled={!listo} onClick={() => setGenerado(true)}>
            <Icono nombre="papelera" tam={18} />Generar script de borrado
          </button>
        </div>
      </section>

      {generado && (
        <section class="panel">
          <div class="panel-cabecera">
            <h2>Script de borrado</h2>
            <p>Antes de borrar nada, muestra qué va a eliminar y te pide confirmación.</p>
          </div>
          <VisorScript script={scriptBorrado({ modo, clase, realm, bases })} fichero={fichero} />
          <h3 style="margin:24px 0 12px">Cómo ejecutarlo</h3>
          <ComoEjecutar fichero={fichero} destructivo />
        </section>
      )}
    </>
  );
}
