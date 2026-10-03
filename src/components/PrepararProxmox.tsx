import { useEffect, useState } from 'preact/hooks';
import VisorScript, { type Variante } from './VisorScript';
import { AJUSTES_POR_DEFECTO, leerAjustes } from '../lib/ajustes';
import { PRIVILEGIOS_ALUMNO, scriptPreparar } from '../lib/proxmox/preparar';

const VARIANTES: Variante[] = [
  { id: 'simular', nombre: 'Simular', args: ['--dry-run'], explicacion: 'Muestra qué roles crearía o actualizaría.' },
  { id: 'preparar', nombre: 'Preparar', args: [], explicacion: 'Crea o actualiza los roles. Se puede repetir.' },
];

export default function PrepararProxmox() {
  const [rol, setRol] = useState(AJUSTES_POR_DEFECTO.rol);
  useEffect(() => setRol(leerAjustes().rol), []);

  return (
    <>
      <details class="privilegios">
        <summary>Qué puede hacer el rol «{rol}» ({PRIVILEGIOS_ALUMNO.length} privilegios)</summary>
        <div class="tabla-envoltorio" style="margin-top:12px">
          <table>
            <tbody>
              {PRIVILEGIOS_ALUMNO.map((p) => (
                <tr key={p.priv}><td class="mono">{p.priv}</td><td>{p.para}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
        <p style="margin-top:12px;color:var(--tinta-tenue);font-size:.875rem">
          No incluye migrar, hacer copias de seguridad, subir ISOs ni tocar permisos. En Proxmox VE 9 se añade
          <code>VM.GuestAgent.Audit</code> para que vean la IP de sus máquinas.
        </p>
      </details>
      <VisorScript script={scriptPreparar({ rol })} fichero="preparar-proxmox.sh" variantes={VARIANTES} />
    </>
  );
}
