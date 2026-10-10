import { useEffect, useState } from 'preact/hooks';
import Icono from './Icono';
import Credenciales from './Credenciales';
import VisorScript, { type Variante } from './VisorScript';
import { AJUSTES_POR_DEFECTO, leerAjustes, type Ajustes } from '../lib/ajustes';
import { claseId, poolDe, usuarioCompleto, validarIdentificador } from '../lib/names';
import { generarPassword } from '../lib/passwords';
import { scriptMover } from '../lib/proxmox/mover';

const VARIANTES: Variante[] = [
  { id: 'simular', nombre: 'Simular', args: ['--dry-run'], explicacion: 'Comprueba que todo existe y muestra los pasos.' },
  { id: 'mover', nombre: 'Mover', args: [], explicacion: 'Crea el usuario nuevo, le pasa sus máquinas y borra el antiguo.' },
];

export default function MoverAlumno() {
  const [ajustes, setAjustes] = useState<Ajustes>(AJUSTES_POR_DEFECTO);
  const [origenNombre, setOrigenNombre] = useState('');
  const [usuario, setUsuario] = useState('');
  const [destinoNombre, setDestinoNombre] = useState('');
  const [password, setPassword] = useState('');
  useEffect(() => {
    const a = leerAjustes();
    setAjustes(a);
    setPassword(generarPassword(a.estiloPassword));
  }, []);

  const origen = claseId(origenNombre);
  const destino = claseId(destinoNombre);
  const u = usuario.trim().toLowerCase().replace(/@.*$/, '');
  const base = origen && u.endsWith(`-${origen}`) ? u.slice(0, -origen.length - 1) : u;
  const viejo = base && origen ? `${usuarioCompleto(base, origen)}@${ajustes.realm}` : '';
  const nuevo = base && destino ? `${usuarioCompleto(base, destino)}@${ajustes.realm}` : '';
  const error = [origen && validarIdentificador(origen), destino && validarIdentificador(destino), base && validarIdentificador(usuarioCompleto(base, destino || 'x'))].find(Boolean);
  const listo = !!origen && !!destino && origen !== destino && !!base && !error && !!password;

  return (
    <>
      <section class="panel">
        <div class="panel-cabecera">
          <h2>¿Quién cambia de clase?</h2>
          <p>Proxmox no permite renombrar usuarios: el alumno recibe un usuario nuevo de su clase nueva, con una contraseña nueva, y conserva sus máquinas.</p>
        </div>
        <div class="campos">
          <div class="campo">
            <label for="mv-origen">Clase actual</label>
            <input id="mv-origen" type="text" placeholder="2º ASIR" value={origenNombre} onInput={(e) => setOrigenNombre(e.currentTarget.value)} />
          </div>
          <div class="campo">
            <label for="mv-usuario">Alumno</label>
            <input id="mv-usuario" type="text" placeholder="jperez-asir2" value={usuario} onInput={(e) => setUsuario(e.currentTarget.value)} />
            <small>{viejo ? <>Usuario actual <code>{viejo}</code></> : 'Su usuario de Proxmox.'}</small>
          </div>
          <div class="campo">
            <label for="mv-destino">Clase nueva</label>
            <input id="mv-destino" type="text" placeholder="2º DAM" value={destinoNombre} onInput={(e) => setDestinoNombre(e.currentTarget.value)} />
            <small>{nuevo ? <>Usuario nuevo <code>{nuevo}</code>, pool <code>{poolDe(base, destino)}</code></> : 'Debe estar creada.'}</small>
          </div>
          <div class="campo">
            <label for="mv-pass">Contraseña nueva</label>
            <div style="display:flex;gap:6px">
              <input id="mv-pass" type="text" value={password} onInput={(e) => setPassword(e.currentTarget.value)} />
              <button type="button" class="btn" aria-label="Generar otra contraseña" onClick={() => setPassword(generarPassword(ajustes.estiloPassword))}><Icono nombre="dados" tam={18} /></button>
            </div>
          </div>
        </div>
        {error && <p style="margin-top:12px;color:var(--rojo);font-weight:700;font-size:.875rem">{error}</p>}
        {origen && destino && origen === destino && <p style="margin-top:12px;color:var(--rojo);font-weight:700;font-size:.875rem">La clase nueva es la misma que la actual.</p>}
      </section>
      {listo && (
        <>
          <section class="panel">
            <VisorScript
              script={scriptMover({ realm: ajustes.realm, rol: ajustes.rol, claseOrigen: origen, baseOrigen: base, claseDestino: destino, baseDestino: base, password })}
              fichero={`mover-${base}-${destino}.sh`}
              variantes={VARIANTES}
              conPasswords
            />
          </section>
          <Credenciales
            titulo="Nuevo acceso del alumno"
            ajustes={ajustes}
            etiqueta={usuarioCompleto(base, destino)}
            lista={[{ nombre: viejo.replace(/@.*/, ''), usuario: nuevo, pool: poolDe(base, destino), password }]}
          />
        </>
      )}
    </>
  );
}
