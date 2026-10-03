import { useEffect, useState } from 'preact/hooks';
import { createPortal } from 'preact/compat';
import Icono from './Icono';
import { descargar, type Ajustes } from '../lib/ajustes';

export interface Credencial {
  nombre: string;
  usuario: string;
  pool: string;
  password: string;
}

/** Panel para guardar y repartir credenciales: resumen .txt (opcional), CSV y papeletas. */
export default function Credenciales({ lista, ajustes, etiqueta, resumen, titulo = 'Resumen y credenciales' }: {
  lista: Credencial[];
  ajustes: Ajustes;
  etiqueta: string;
  resumen?: string;
  titulo?: string;
}) {
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
        <h3>{titulo}</h3>
        <p>
          Guárdalos antes de cerrar la página: no se almacenan en ningún sitio.
          {resumen && <> El resumen .txt te sirve de registro y para <a href="/proxmox/borrar/">borrar estos usuarios</a> más adelante.</>}
        </p>
      </div>
      <div class="acciones-grupo">
        {resumen && (
          <button type="button" class="btn btn-primario" onClick={() => descargar(`resumen-${etiqueta}.txt`, resumen)}>
            <Icono nombre="fichero" tam={18} />Descargar resumen
          </button>
        )}
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
                  {c.pool && (<><dt>Tu pool</dt><dd>{c.pool}</dd></>)}
                </dl>
              </div>
            ))}
          </div>,
          document.body,
        )}
    </div>
  );
}
