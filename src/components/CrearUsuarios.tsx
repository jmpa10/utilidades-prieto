import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import Icono from './Icono';
import VisorScript, { type Variante } from './VisorScript';
import { AJUSTES_POR_DEFECTO, descargar, leerAjustes, type Ajustes } from '../lib/ajustes';
import { asignarBases, baseUsuario, claseId, formatoLista, parsearLinea, parsearTexto, poolDe, usuarioCompleto, validarIdentificador, type Persona } from '../lib/names';
import { generarPassword } from '../lib/passwords';
import { scriptCreacion } from '../lib/proxmox/create';
import { resumenTxt } from '../lib/proxmox/resumen';

interface Fila {
  id: number;
  persona: Persona;
  base: string;
  password: string;
  avisos: string[];
}

interface Credencial {
  nombre: string;
  usuario: string;
  pool: string;
  password: string;
}

const PASOS = ['Clase', 'Alumnos', 'Revisión', 'Script'];
const VARIANTES: Variante[] = [
  { id: 'simular', nombre: 'Simular', args: ['--dry-run'], explicacion: 'Muestra todo lo que haría, sin cambiar nada en Proxmox.' },
  { id: 'crear', nombre: 'Crear usuarios', args: [], explicacion: 'Crea grupo, pools, usuarios y permisos. Se puede repetir sin duplicar.' },
];
const EJEMPLO = `# Una persona por línea: Apellidos, Nombre
Pérez García, Juan
de la Fuente Ruiz, María José
Núñez Ibáñez, Ángel`;

export default function CrearUsuarios() {
  const [ajustes, setAjustes] = useState<Ajustes>(AJUSTES_POR_DEFECTO);
  const [modo, setModo] = useState<'lote' | 'individual'>('lote');
  useEffect(() => {
    setAjustes(leerAjustes());
    if (location.hash === '#individual') setModo('individual');
  }, []);

  return (
    <>
      <div class="segmentos" role="tablist" aria-label="Modo de creación">
        <button type="button" role="tab" class="segmento" aria-selected={modo === 'lote'} onClick={() => setModo('lote')}>
          <Icono nombre="usuarios" tam={18} /> Clase completa
        </button>
        <button type="button" role="tab" class="segmento" aria-selected={modo === 'individual'} onClick={() => setModo('individual')}>
          <Icono nombre="usuarioMas" tam={18} /> Un solo usuario
        </button>
      </div>
      {modo === 'lote' ? <Lote ajustes={ajustes} /> : <Individual ajustes={ajustes} />}
    </>
  );
}

/* ── Opciones comunes de recursos ─────────────────────────── */
interface Recursos {
  cuotaGB: number;
  storage: string;
  rolStorage: string;
  rol: string;
}

function CamposRecursos({ valor, onChange }: { valor: Recursos; onChange: (r: Recursos) => void }) {
  const set = (parcial: Partial<Recursos>) => onChange({ ...valor, ...parcial });
  return (
    <div class="campos">
      <div class="campo">
        <label for="cuota">Espacio por alumno (GB)</label>
        <input id="cuota" type="number" min="1" step="1" value={valor.cuotaGB} onInput={(e) => set({ cuotaGB: Number(e.currentTarget.value) })} />
        <small>Se anota en el pool y se revisa en «Uso de disco».</small>
      </div>
      <div class="campo">
        <label for="rol">Rol sobre su pool</label>
        <input id="rol" type="text" value={valor.rol} onInput={(e) => set({ rol: e.currentTarget.value.trim() })} />
        <small>Debe existir ya en Proxmox.</small>
      </div>
      <div class="campo">
        <label for="storage">Storage del pool</label>
        <input id="storage" type="text" placeholder="local-lvm" value={valor.storage} onInput={(e) => set({ storage: e.currentTarget.value.trim() })} />
        <small>Se añade al pool de cada alumno. Vacío: no se añade.</small>
      </div>
      <div class="campo">
        <label for="rolStorage">Rol de la clase sobre ese storage</label>
        <input id="rolStorage" type="text" placeholder="PVEDatastoreUser" value={valor.rolStorage} onInput={(e) => set({ rolStorage: e.currentTarget.value.trim() })} />
        <small>Opcional. Vacío si ya tenéis ese permiso puesto.</small>
      </div>
    </div>
  );
}

/* ── Credenciales: CSV y papeletas ────────────────────────── */
function Credenciales({ lista, ajustes, etiqueta, resumen }: { lista: Credencial[]; ajustes: Ajustes; etiqueta: string; resumen: string }) {
  const [imprimir, setImprimir] = useState(false);

  useEffect(() => {
    if (!imprimir) return;
    const fin = () => {
      document.body.classList.remove('imprimiendo');
      setImprimir(false);
    };
    document.body.classList.add('imprimiendo');
    window.addEventListener('afterprint', fin, { once: true });
    const t = setTimeout(() => window.print(), 50);
    return () => {
      clearTimeout(t);
      window.removeEventListener('afterprint', fin);
    };
  }, [imprimir]);

  function csv() {
    const celda = (s: string) => `"${s.replace(/"/g, '""')}"`;
    const filas = [['Nombre', 'Usuario', 'Contraseña', 'Pool', 'Acceso'], ...lista.map((c) => [c.nombre, c.usuario, c.password, c.pool, ajustes.urlProxmox])];
    descargar(`credenciales-${etiqueta}.csv`, '﻿' + filas.map((f) => f.map(celda).join(';')).join('\r\n'), 'text/csv');
  }

  return (
    <div class="panel">
      <div class="panel-cabecera">
        <h3>Resumen y credenciales</h3>
        <p>
          Guárdalos antes de cerrar la página: no se almacenan en ningún sitio. El resumen .txt te sirve de registro
          y para <a href="/proxmox/borrar/">borrar estos usuarios</a> más adelante.
        </p>
      </div>
      <div class="acciones-grupo">
        <button type="button" class="btn btn-primario" onClick={() => descargar(`resumen-${etiqueta}.txt`, resumen)}>
          <Icono nombre="fichero" tam={18} />Descargar resumen
        </button>
        <button type="button" class="btn btn-azul" onClick={csv}><Icono nombre="descargar" tam={18} />Descargar CSV</button>
        <button type="button" class="btn" onClick={() => setImprimir(true)}><Icono nombre="imprimir" tam={18} />Imprimir papeletas</button>
      </div>
      {!ajustes.urlProxmox && (
        <p style="margin-top:14px;color:var(--tinta-tenue);font-size:.875rem">
          Añade la dirección del Proxmox en <a href="/proxmox/ajustes/">Ajustes</a> para que aparezca en las papeletas.
        </p>
      )}
      {imprimir &&
        createPortal(
          <div class="papeletas">
            {lista.map((c) => (
              <div class="papeleta" key={c.usuario}>
                <h4>{c.nombre}</h4>
                <p>{ajustes.centro} · Acceso a Proxmox</p>
                <dl>
                  {ajustes.urlProxmox && (<><dt>Dirección</dt><dd>{ajustes.urlProxmox}</dd></>)}
                  <dt>Usuario</dt><dd>{c.usuario.replace(/@.*/, '')}</dd>
                  <dt>Dominio</dt><dd>{ajustes.realm === 'pve' ? 'Proxmox VE authentication server' : ajustes.realm}</dd>
                  <dt>Contraseña</dt><dd>{c.password}</dd>
                  <dt>Tu pool</dt><dd>{c.pool}</dd>
                </dl>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}

/* ── Asistente por clase ──────────────────────────────────── */
function Lote({ ajustes }: { ajustes: Ajustes }) {
  const [paso, setPaso] = useState(0);
  const [claseNombre, setClaseNombre] = useState('');
  const [esperados, setEsperados] = useState('');
  const [texto, setTexto] = useState('');
  const [filas, setFilas] = useState<Fila[]>([]);
  const [textoFilas, setTextoFilas] = useState<string | null>(null);
  const [recursos, setRecursos] = useState<Recursos>({ cuotaGB: ajustes.cuotaGB, storage: ajustes.storage, rolStorage: ajustes.rolStorage, rol: ajustes.rol });
  const [arrastrando, setArrastrando] = useState(false);
  const fichero = useRef<HTMLInputElement>(null);
  const titulo = useRef<HTMLHeadingElement>(null);

  useEffect(() => setRecursos({ cuotaGB: ajustes.cuotaGB, storage: ajustes.storage, rolStorage: ajustes.rolStorage, rol: ajustes.rol }), [ajustes]);
  useEffect(() => titulo.current?.focus(), [paso]);

  const clase = claseId(claseNombre);
  const errorClase = claseNombre ? validarIdentificador(clase) : null;
  const personas = useMemo(() => parsearTexto(texto), [texto]);
  const n = Number(esperados) || 0;

  function construirFilas() {
    if (textoFilas === texto) return;
    const bases = asignarBases(personas);
    setFilas(personas.map((p, i) => ({ id: i, persona: p, base: bases[i].base, avisos: bases[i].avisos, password: generarPassword(ajustes.estiloPassword) })));
    setTextoFilas(texto);
  }

  const erroresFila = useMemo(() => {
    const cuenta = new Map<string, number>();
    filas.forEach((f) => cuenta.set(f.base, (cuenta.get(f.base) ?? 0) + 1));
    return filas.map((f) => validarIdentificador(usuarioCompleto(f.base, clase)) ?? ((cuenta.get(f.base) ?? 0) > 1 ? 'Repetido' : null));
  }, [filas, clase]);
  const hayErrores = erroresFila.some(Boolean) || !recursos.rol;

  const script = useMemo(
    () =>
      paso === 3
        ? scriptCreacion({ clase, claseNombre, realm: ajustes.realm, rol: recursos.rol, cuotaGB: recursos.cuotaGB || null, storage: recursos.storage, rolStorage: recursos.rolStorage, usuarios: filas.map((f) => ({ base: f.base, nombre: f.persona.completo, password: f.password })) })
        : '',
    [paso, filas, recursos, clase, claseNombre, ajustes.realm],
  );

  const resumenLote = () =>
    resumenTxt({
      clase, claseNombre, realm: ajustes.realm, rol: recursos.rol, cuotaGB: recursos.cuotaGB || null, storage: recursos.storage,
      urlProxmox: ajustes.urlProxmox, centro: ajustes.centro,
      usuarios: filas.map((f) => ({ userid: `${usuarioCompleto(f.base, clase)}@${ajustes.realm}`, pool: poolDe(f.base, clase), password: f.password, nombre: formatoLista(f.persona) })),
    });

  async function leerFichero(f?: File | null) {
    if (!f) return;
    setTexto(await f.text());
  }

  const editar = (id: number, parcial: Partial<Fila>) => setFilas((fs) => fs.map((f) => (f.id === id ? { ...f, ...parcial } : f)));
  const puedeAvanzar = [!!clase && !errorClase, personas.length > 0, filas.length > 0 && !hayErrores, true][paso];
  const irA = (p: number) => {
    if (p >= 2) construirFilas();
    // Al generar el script se descarga también el resumen, para que el profesor no lo olvide.
    if (p === 3 && paso === 2) descargar(`resumen-${clase}.txt`, resumenLote());
    setPaso(p);
  };

  return (
    <>
      <ol class="camino" aria-label="Pasos">
        {PASOS.map((nombre, i) => (
          <li class={i < paso ? 'hecho' : i === paso ? 'actual' : ''} key={nombre}>
            <button type="button" class="paso-bola" disabled={i > paso} onClick={() => irA(i)} aria-current={i === paso ? 'step' : undefined} aria-label={`Paso ${i + 1}: ${nombre}`}>
              {i < paso ? <Icono nombre="check" tam={24} /> : i + 1}
            </button>
            <span class="paso-nombre">{nombre}</span>
          </li>
        ))}
      </ol>

      <section class="panel" aria-live="polite">
        {paso === 0 && (
          <>
            <div class="panel-cabecera">
              <h2 tabIndex={-1} ref={titulo}>¿Para qué clase son?</h2>
              <p>El nombre de la clase se añade a cada usuario y agrupa sus pools.</p>
            </div>
            <div class="campos">
              <div class="campo">
                <label for="clase">Clase</label>
                <input id="clase" type="text" placeholder="2º ASIR" value={claseNombre} aria-invalid={!!errorClase} onInput={(e) => setClaseNombre(e.currentTarget.value)} autoFocus />
                {errorClase ? <small class="error">{errorClase}</small> : <small>Se guarda como <code>{clase || '2asir'}</code></small>}
              </div>
              <div class="campo">
                <label for="esperados">¿Cuántos alumnos son?</label>
                <input id="esperados" type="number" min="1" placeholder="Opcional" value={esperados} onInput={(e) => setEsperados(e.currentTarget.value)} />
                <small>Para avisarte si la lista no cuadra.</small>
              </div>
            </div>
            {clase && !errorClase && (
              <div class="aviso aviso-ok" style="margin-top:20px">
                <Icono nombre="info" />
                <span>
                  Cada alumno tendrá el usuario <code>jperez-{clase}@{ajustes.realm}</code> y el pool <code>{clase}/jperez-{clase}</code>, dentro del pool y del grupo <code>{clase}</code>.
                </span>
              </div>
            )}
          </>
        )}

        {paso === 1 && (
          <>
            <div class="panel-cabecera">
              <h2 tabIndex={-1} ref={titulo}>¿Quién está en {claseNombre}?</h2>
              <p>Sube el TXT exportado de la plataforma o pega la lista. Una persona por línea con el formato <code>Apellidos, Nombre</code>.</p>
            </div>
            <div
              class={`dropzone${arrastrando ? ' activa' : ''}`}
              role="button"
              tabIndex={0}
              onClick={() => fichero.current?.click()}
              onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), fichero.current?.click())}
              onDragOver={(e) => (e.preventDefault(), setArrastrando(true))}
              onDragLeave={() => setArrastrando(false)}
              onDrop={(e) => {
                e.preventDefault();
                setArrastrando(false);
                leerFichero(e.dataTransfer?.files[0]);
              }}
            >
              <Icono nombre="subir" tam={32} />
              <strong>Arrastra aquí el fichero .txt o haz clic para elegirlo</strong>
              <p>También vale un .csv con una persona por línea.</p>
              <input ref={fichero} type="file" accept=".txt,.csv,text/plain" hidden onChange={(e) => leerFichero(e.currentTarget.files?.[0])} />
            </div>
            <div class="campo" style="margin-top:20px">
              <label for="lista">Lista de alumnos</label>
              <textarea id="lista" rows={10} placeholder={EJEMPLO} value={texto} onInput={(e) => setTexto(e.currentTarget.value)} spellcheck={false} />
              <small>
                {personas.length ? `${personas.length} alumno${personas.length === 1 ? '' : 's'} detectado${personas.length === 1 ? '' : 's'}` : 'Las líneas vacías y las que empiezan por # se ignoran.'}
              </small>
            </div>
            {n > 0 && personas.length > 0 && n !== personas.length && (
              <div class="aviso" style="margin-top:16px">
                <Icono nombre="alerta" />
                <span>Esperabas {n} alumnos y la lista tiene {personas.length}. Revisa que no falte nadie.</span>
              </div>
            )}
          </>
        )}

        {paso === 2 && (
          <>
            <div class="panel-cabecera">
              <h2 tabIndex={-1} ref={titulo}>Revisa los usuarios</h2>
              <p>Puedes cambiar cualquier usuario o contraseña antes de generar el script.</p>
            </div>
            <div class="resumen-lote" style="margin-bottom:20px">
              <span><strong>{filas.length}</strong>alumnos</span>
              <span><strong>{recursos.cuotaGB || 0} GB</strong>por pool</span>
              <span><strong>{(recursos.cuotaGB || 0) * filas.length} GB</strong>en total como máximo</span>
            </div>
            <div class="tabla-envoltorio">
              <table>
                <thead>
                  <tr><th>Alumno</th><th>Usuario</th><th>Contraseña</th><th><span class="visually-hidden">Acciones</span></th></tr>
                </thead>
                <tbody>
                  {filas.map((f, i) => (
                    <tr key={f.id}>
                      <td>
                        {f.persona.completo}
                        {f.avisos.map((a) => <div key={a}><span class="etiqueta">{a}</span></div>)}
                        {erroresFila[i] && <div><span class="etiqueta etiqueta-error">{erroresFila[i]}</span></div>}
                      </td>
                      <td>
                        <div style="display:flex;align-items:center;gap:6px">
                          <input type="text" aria-label={`Usuario de ${f.persona.completo}`} value={f.base} aria-invalid={!!erroresFila[i]} onInput={(e) => editar(f.id, { base: e.currentTarget.value.toLowerCase().trim(), avisos: [] })} style="min-width:110px" />
                          <span class="mono" style="color:var(--tinta-tenue);white-space:nowrap">-{clase}@{ajustes.realm}</span>
                        </div>
                      </td>
                      <td>
                        <div style="display:flex;align-items:center;gap:4px">
                          <input type="text" aria-label={`Contraseña de ${f.persona.completo}`} value={f.password} onInput={(e) => editar(f.id, { password: e.currentTarget.value })} style="min-width:220px" />
                          <button type="button" class="btn btn-texto" title="Generar otra" aria-label={`Generar otra contraseña para ${f.persona.completo}`} onClick={() => editar(f.id, { password: generarPassword(ajustes.estiloPassword) })}>
                            <Icono nombre="dados" tam={18} />
                          </button>
                        </div>
                      </td>
                      <td>
                        <button type="button" class="btn btn-texto" aria-label={`Quitar a ${f.persona.completo}`} title="Quitar de la lista" onClick={() => setFilas((fs) => fs.filter((x) => x.id !== f.id))}>
                          <Icono nombre="papelera" tam={18} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <h3 style="margin:28px 0 16px">Recursos y permisos</h3>
            <CamposRecursos valor={recursos} onChange={setRecursos} />
          </>
        )}

        {paso === 3 && (
          <>
            <div class="panel-cabecera">
              <h2 tabIndex={-1} ref={titulo}>Script listo para {claseNombre}</h2>
              <p>Crea {filas.length} usuarios con su pool. Puedes ejecutarlo más de una vez: se salta lo que ya existe.</p>
            </div>
            <div class="aviso aviso-ok" style="margin-bottom:20px">
              <Icono nombre="fichero" />
              <span>Se ha descargado <code>resumen-{clase}.txt</code> con los usuarios y contraseñas creados. Guárdalo: lo necesitarás para borrar la clase.</span>
            </div>
            <VisorScript script={script} fichero={`crear-${clase}.sh`} variantes={VARIANTES} conPasswords />
          </>
        )}

        <div class="acciones">
          {paso > 0 ? (
            <button type="button" class="btn" onClick={() => setPaso(paso - 1)}><Icono nombre="atras" tam={18} />Atrás</button>
          ) : <span />}
          {paso < 3 && (
            <button type="button" class="btn btn-primario" disabled={!puedeAvanzar} onClick={() => irA(paso + 1)}>
              {paso === 2 ? 'Generar script' : 'Continuar'}
              <Icono nombre="adelante" tam={18} />
            </button>
          )}
        </div>
      </section>

      {paso === 3 && (
        <Credenciales
          ajustes={ajustes}
          etiqueta={clase}
          resumen={resumenLote()}
          lista={filas.map((f) => ({ nombre: f.persona.completo, usuario: `${usuarioCompleto(f.base, clase)}@${ajustes.realm}`, pool: poolDe(f.base, clase), password: f.password }))}
        />
      )}
    </>
  );
}

/* ── Alta individual (alumno o profesor) ──────────────────── */
function Individual({ ajustes }: { ajustes: Ajustes }) {
  const [nombre, setNombre] = useState('');
  const [base, setBase] = useState('');
  const [baseEditada, setBaseEditada] = useState(false);
  const [claseNombre, setClaseNombre] = useState('');
  const [password, setPassword] = useState('');
  const [recursos, setRecursos] = useState<Recursos>({ cuotaGB: ajustes.cuotaGB, storage: ajustes.storage, rolStorage: '', rol: ajustes.rol });
  const [generado, setGenerado] = useState(false);

  useEffect(() => setPassword(generarPassword(ajustes.estiloPassword)), [ajustes.estiloPassword]);
  useEffect(() => setRecursos({ cuotaGB: ajustes.cuotaGB, storage: ajustes.storage, rolStorage: '', rol: ajustes.rol }), [ajustes]);

  const persona = parsearLinea(nombre);
  useEffect(() => {
    if (!baseEditada) setBase(persona ? baseUsuario(persona) : '');
  }, [nombre]);
  useEffect(() => setGenerado(false), [nombre, base, claseNombre, password, recursos]);

  const clase = claseId(claseNombre);
  const usuario = usuarioCompleto(base, clase);
  const errorUsuario = base ? validarIdentificador(usuario) : null;
  const completo = persona?.completo ?? nombre.trim();
  const valido = !!completo && !!base && !errorUsuario && !!password && !!recursos.rol;

  const script = generado
    ? scriptCreacion({ clase, claseNombre, realm: ajustes.realm, rol: recursos.rol, cuotaGB: recursos.cuotaGB || null, storage: recursos.storage, rolStorage: recursos.rolStorage, usuarios: [{ base, nombre: completo, password }] })
    : '';

  return (
    <>
      <section class="panel">
        <div class="panel-cabecera">
          <h2>Un usuario con su pool</h2>
          <p>Para un alumno que llega a mitad de curso o para un profesor.</p>
        </div>
        <div class="campos">
          <div class="campo">
            <label for="ind-nombre">Nombre</label>
            <input id="ind-nombre" type="text" placeholder="Pérez García, Juan" value={nombre} onInput={(e) => setNombre(e.currentTarget.value)} />
            <small>«Apellidos, Nombre» o «Nombre Apellidos».</small>
          </div>
          <div class="campo">
            <label for="ind-clase">Clase</label>
            <input id="ind-clase" type="text" placeholder="2º ASIR" value={claseNombre} onInput={(e) => setClaseNombre(e.currentTarget.value)} />
            <small>Vacío para un profesor: tendrá un pool propio fuera de las clases.</small>
          </div>
          <div class="campo">
            <label for="ind-usuario">Usuario</label>
            <input id="ind-usuario" type="text" value={base} aria-invalid={!!errorUsuario} onInput={(e) => (setBase(e.currentTarget.value.toLowerCase().trim()), setBaseEditada(true))} />
            {errorUsuario ? <small class="error">{errorUsuario}</small> : <small>Quedará <code>{usuario || 'usuario'}@{ajustes.realm}</code>, pool <code>{base ? poolDe(base, clase) : '…'}</code></small>}
          </div>
          <div class="campo">
            <label for="ind-pass">Contraseña</label>
            <div style="display:flex;gap:6px">
              <input id="ind-pass" type="text" value={password} onInput={(e) => setPassword(e.currentTarget.value)} />
              <button type="button" class="btn" title="Generar otra" aria-label="Generar otra contraseña" onClick={() => setPassword(generarPassword(ajustes.estiloPassword))}><Icono nombre="dados" tam={18} /></button>
            </div>
          </div>
        </div>
        <h3 style="margin:28px 0 16px">Recursos y permisos</h3>
        <CamposRecursos valor={recursos} onChange={setRecursos} />
        <div class="acciones">
          <span />
          <button type="button" class="btn btn-primario" disabled={!valido} onClick={() => setGenerado(true)}>Generar script<Icono nombre="adelante" tam={18} /></button>
        </div>
      </section>
      {generado && (
        <>
          <section class="panel">
            <div class="panel-cabecera">
              <h2>Script listo</h2>
              <p>Crea <code>{usuario}@{ajustes.realm}</code> y su pool.</p>
            </div>
            <VisorScript script={script} fichero={`crear-${usuario}.sh`} variantes={VARIANTES} conPasswords />
          </section>
          <Credenciales
            ajustes={ajustes}
            etiqueta={usuario}
            resumen={resumenTxt({ clase, claseNombre, realm: ajustes.realm, rol: recursos.rol, cuotaGB: recursos.cuotaGB || null, storage: recursos.storage, urlProxmox: ajustes.urlProxmox, centro: ajustes.centro, usuarios: [{ userid: `${usuario}@${ajustes.realm}`, pool: poolDe(base, clase), password, nombre: persona ? formatoLista(persona) : completo }] })}
            lista={[{ nombre: completo, usuario: `${usuario}@${ajustes.realm}`, pool: poolDe(base, clase), password }]} />
        </>
      )}
    </>
  );
}
