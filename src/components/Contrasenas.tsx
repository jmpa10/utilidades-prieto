import { useEffect, useMemo, useState } from 'preact/hooks';
import Icono from './Icono';
import Credenciales from './Credenciales';
import VisorScript, { type Variante } from './VisorScript';
import { AJUSTES_POR_DEFECTO, leerAjustes, type Ajustes } from '../lib/ajustes';
import { generarPassword } from '../lib/passwords';
import { leerResumen } from '../lib/proxmox/resumen';
import { scriptPassword } from '../lib/proxmox/password';

const VARIANTES: Variante[] = [
  { id: 'simular', nombre: 'Simular', args: ['--dry-run'], explicacion: 'Comprueba que los usuarios existen, sin cambiar nada.' },
  { id: 'cambiar', nombre: 'Cambiar contraseñas', args: [], explicacion: 'Pone las contraseñas nuevas.' },
];

interface Fila {
  userid: string;
  nombre: string;
  password: string;
}

export default function Contrasenas() {
  const [ajustes, setAjustes] = useState<Ajustes>(AJUSTES_POR_DEFECTO);
  const [texto, setTexto] = useState('');
  const [filas, setFilas] = useState<Fila[]>([]);
  useEffect(() => setAjustes(leerAjustes()), []);

  // Usuarios del texto: «jperez-2asir», «jperez-2asir@pve» o un resumen TXT (que trae los nombres).
  const usuarios = useMemo(() => {
    const resumen = leerResumen(texto);
    if (resumen) return resumen.usuarios.map((u) => ({ userid: u.userid, nombre: u.nombre }));
    return [...new Set(texto.split(/[\s,;]+/).filter(Boolean))].map((u) => ({ userid: u.includes('@') ? u : `${u}@${ajustes.realm}`, nombre: '' }));
  }, [texto, ajustes.realm]);

  useEffect(() => {
    setFilas((anteriores) =>
      usuarios.map((u) => anteriores.find((f) => f.userid === u.userid) ?? { ...u, password: generarPassword(ajustes.estiloPassword) }),
    );
  }, [usuarios]);

  const malos = filas.filter((f) => !/^[a-z0-9][a-z0-9._-]*@[a-z0-9_-]+$/i.test(f.userid)).map((f) => f.userid);
  const editar = (userid: string, password: string) => setFilas((fs) => fs.map((f) => (f.userid === userid ? { ...f, password } : f)));

  async function cargar(f?: File | null) {
    if (f) setTexto(await f.text());
  }

  return (
    <>
      <section class="panel">
        <div class="panel-cabecera">
          <h2>¿De quién?</h2>
          <p>Para el alumno que ha olvidado la contraseña, o para toda la clase cargando su resumen.</p>
        </div>
        <div class="campo">
          <label for="pw-usuarios">Usuarios</label>
          <textarea id="pw-usuarios" rows={3} placeholder="jperez-2asir" value={texto} onInput={(e) => setTexto(e.currentTarget.value)} spellcheck={false} style="min-height:90px" />
          <small>
            Separados por comas o espacios.{' '}
            <label style="cursor:pointer;text-decoration:underline">
              O carga el resumen .txt de la clase
              <input type="file" accept=".txt,text/plain" hidden onChange={(e) => cargar(e.currentTarget.files?.[0])} />
            </label>
          </small>
          {malos.length > 0 && <small class="error">No parecen usuarios: {malos.join(', ')}</small>}
        </div>
        {filas.length > 0 && (
          <div class="tabla-envoltorio" style="margin-top:20px">
            <table>
              <thead><tr><th>Usuario</th><th>Contraseña nueva</th></tr></thead>
              <tbody>
                {filas.map((f) => (
                  <tr key={f.userid}>
                    <td class="mono">{f.userid}{f.nombre && <div style="font-family:var(--fuente-ui);color:var(--tinta-tenue)">{f.nombre}</div>}</td>
                    <td>
                      <div style="display:flex;gap:4px;align-items:center">
                        <input type="text" aria-label={`Contraseña de ${f.userid}`} value={f.password} onInput={(e) => editar(f.userid, e.currentTarget.value)} style="min-width:220px" />
                        <button type="button" class="btn btn-texto" aria-label={`Generar otra para ${f.userid}`} onClick={() => editar(f.userid, generarPassword(ajustes.estiloPassword))}>
                          <Icono nombre="dados" tam={18} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      {filas.length > 0 && !malos.length && filas.every((f) => f.password) && (
        <>
          <section class="panel">
            <VisorScript script={scriptPassword({ usuarios: filas })} fichero="contrasenas.sh" variantes={VARIANTES} conPasswords />
          </section>
          <Credenciales
            titulo="Contraseñas nuevas para repartir"
            ajustes={ajustes}
            etiqueta="contrasenas"
            lista={filas.map((f) => ({ nombre: f.nombre || f.userid, usuario: f.userid, pool: '', password: f.password }))}
          />
        </>
      )}
    </>
  );
}
