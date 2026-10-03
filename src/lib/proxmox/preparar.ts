import { fechaHora, q } from '../shell';
import { CABECERA_COMUN } from './common';

/** Privilegios del rol del alumno sobre su propio pool: crear, configurar, usar y borrar sus máquinas. */
export const PRIVILEGIOS_ALUMNO: { priv: string; para: string }[] = [
  { priv: 'VM.Allocate', para: 'Crear y borrar máquinas en su pool' },
  { priv: 'VM.PowerMgmt', para: 'Encender, apagar, reiniciar y parar' },
  { priv: 'VM.Console', para: 'Abrir la consola' },
  { priv: 'VM.Audit', para: 'Ver sus máquinas y su configuración' },
  { priv: 'VM.Config.Disk', para: 'Discos' },
  { priv: 'VM.Config.CPU', para: 'Procesador' },
  { priv: 'VM.Config.Memory', para: 'Memoria' },
  { priv: 'VM.Config.Network', para: 'Tarjetas de red (solo en el bridge de su clase)' },
  { priv: 'VM.Config.Options', para: 'Opciones generales (nombre, arranque…)' },
  { priv: 'VM.Config.HWType', para: 'Tipo de hardware (BIOS, controladora…)' },
  { priv: 'VM.Config.CDROM', para: 'Montar ISOs' },
  { priv: 'VM.Config.Cloudinit', para: 'Cloud-init' },
  { priv: 'VM.Snapshot', para: 'Crear instantáneas' },
  { priv: 'VM.Snapshot.Rollback', para: 'Volver a una instantánea' },
  { priv: 'VM.Clone', para: 'Clonar sus máquinas' },
  { priv: 'Datastore.AllocateSpace', para: 'Crear discos en el storage de su pool' },
  { priv: 'Datastore.Audit', para: 'Ver el storage de su pool' },
  { priv: 'Pool.Audit', para: 'Ver su pool' },
];

export interface OpcionesPreparar {
  rol: string;
  fecha?: Date;
}

export function scriptPreparar(o: OpcionesPreparar): string {
  const privs = PRIVILEGIOS_ALUMNO.map((p) => p.priv).join(',');
  return `#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
#  Utilidades Prieto · Proxmox · Preparar Proxmox (una sola vez)
#  Generado: ${fechaHora(o.fecha)}
#
#  Crea o actualiza los roles que usan los scripts de clase:
#  - ${o.rol}: el alumno crea, configura, para y borra máquinas en su pool.
#  - AlumnoISO: solo lectura de las ISOs.
#
#  Uso:  bash preparar-proxmox.sh [--dry-run]
# ──────────────────────────────────────────────────────────────
set -euo pipefail

ROL=${q(o.rol)}
PRIVS=${q(privs)}
${CABECERA_COMUN}
comprobar_entorno

# En Proxmox VE 9, la IP que informa el agente invitado necesita su propio privilegio.
if version_minima 9 0; then
  PRIVS="$PRIVS,VM.GuestAgent.Audit"
fi

titulo "Preparando Proxmox"
(( DRY_RUN )) && aviso "Modo simulación: no se cambia nada."

# preparar_rol <rol> <privilegios>
preparar_rol() {
  if existe "$ROLES" "$1"; then
    run pveum role modify "$1" --privs "$2"
    ok "Rol $1 actualizado"
  else
    run pveum role add "$1" --privs "$2"
    ok "Rol $1 creado"
  fi
}

preparar_rol "$ROL" "$PRIVS"
preparar_rol AlumnoISO Datastore.Audit

titulo "Listo"
info "Privilegios de $ROL: \${PRIVS//,/, }"
`;
}
