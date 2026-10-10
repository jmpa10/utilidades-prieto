import { fechaHora, q } from '../shell';

export interface OpcionesAuditoria {
  /** Clase a auditar («asir2»); vacío → todos los pools con «quota=» en el comentario. */
  clase: string;
  /** Porcentaje a partir del cual se avisa. */
  umbralAviso: number;
  fecha?: Date;
}

const PYTHON = String.raw`
import json, re, subprocess, sys

clase, umbral = sys.argv[1], float(sys.argv[2])
UNIDADES = {"": 1 / 1024**3, "K": 1 / 1024**2, "M": 1 / 1024, "G": 1, "T": 1024}
DISCO = re.compile(r"^((scsi|virtio|sata|ide|mp)\d+|efidisk0|tpmstate0|rootfs)$")

def pvesh(ruta, *args):
    r = subprocess.run(["pvesh", "get", ruta, "--output-format", "json", *args], capture_output=True, text=True)
    return json.loads(r.stdout) if r.returncode == 0 and r.stdout.strip() else None

def tam_gb(valor):
    if "media=cdrom" in valor:
        return 0.0
    m = re.search(r"(?:^|,)size=(\d+(?:\.\d+)?)([KMGT]?)", valor)
    return float(m.group(1)) * UNIDADES[m.group(2)] if m else 0.0

def miembros(pool):
    d = pvesh("/pools", "--poolid", pool) or pvesh("/pools/" + pool) or {}
    if isinstance(d, list):
        d = d[0] if d else {}
    return [m for m in d.get("members", []) if m.get("type") in ("qemu", "lxc")]

filas, excedidos = [], 0
for p in sorted(pvesh("/pools") or [], key=lambda x: x["poolid"]):
    pid, comentario = p["poolid"], p.get("comment") or ""
    if clase and not pid.startswith(clase + "/"):
        continue
    m = re.search(r"quota=(\d+(?:\.\d+)?)G", comentario)
    if not m:
        continue
    cuota = float(m.group(1))
    uso, n = 0.0, 0
    for vm in miembros(pid):
        cfg = pvesh("/nodes/%s/%s/%s/config" % (vm["node"], vm["type"], vm["vmid"])) or {}
        uso += sum(tam_gb(str(v)) for k, v in cfg.items() if DISCO.match(k))
        n += 1
    pct = 100 * uso / cuota if cuota else 0
    if pct > 100:
        estado, excedidos = "EXCEDIDO", excedidos + 1
    elif pct >= umbral:
        estado = "cerca"
    else:
        estado = "ok"
    filas.append((pid, n, uso, cuota, pct, estado))

if not filas:
    print("No hay pools con cuota (quota=NNG en el comentario)" + (" en la clase " + clase if clase else "") + ".")
    sys.exit(0)

print("%-40s %5s %10s %10s %7s  %s" % ("POOL", "VM/CT", "USO (GB)", "CUOTA", "%", "ESTADO"))
print("-" * 86)
for pid, n, uso, cuota, pct, estado in filas:
    print("%-40s %5d %10.1f %10.0f %6.0f%%  %s" % (pid, n, uso, cuota, pct, estado))
print("-" * 86)
print("%d pool(s) · %d por encima de la cuota" % (len(filas), excedidos))
print("Nota: se mide el tamaño APROVISIONADO de los discos (LVM-thin no permite cuotas reales).")
sys.exit(1 if excedidos else 0)
`;

export function scriptAuditoria(o: OpcionesAuditoria): string {
  const nombre = `auditoria-${o.clase || 'cuotas'}`;
  return `#!/usr/bin/env bash
# ──────────────────────────────────────────────────────────────
#  Utilidades Prieto · Proxmox · Auditoría de cuotas
#  Generado: ${fechaHora(o.fecha)}
#  Alcance: ${o.clase ? `clase ${o.clase}` : 'todos los pools con cuota'}
#
#  Suma el tamaño de disco aprovisionado de las VMs/CTs de cada pool
#  y lo compara con la cuota guardada en su comentario (quota=NNG).
#  Es solo informativo: LVM-thin no permite imponer cuotas.
#
#  Uso:  bash ${nombre}.sh                       # muestra el informe
#        bash ${nombre}.sh --instalar-cron [--mail correo@centro.es]
#        bash ${nombre}.sh --desinstalar-cron
# ──────────────────────────────────────────────────────────────
set -euo pipefail

CLASE=${q(o.clase)}
UMBRAL=${q(String(o.umbralAviso))}
DESTINO=/usr/local/sbin/${nombre}
CRON=/etc/cron.d/${nombre}
LOGS=/var/log/utilidades-prieto

MODO=informe; MAIL=''
while (( $# )); do
  case "$1" in
    --instalar-cron) MODO=instalar ;;
    --desinstalar-cron) MODO=desinstalar ;;
    --cron) MODO=cron ;;
    --mail) MAIL="\${2:?Falta el correo}"; shift ;;
    -h|--help) sed -n '2,15p' "$0"; exit 0 ;;
    *) echo "Opción desconocida: $1" >&2; exit 2 ;;
  esac
  shift
done

informe() {
  python3 - "$CLASE" "$UMBRAL" <<'PY'
${PYTHON.trim()}
PY
}

case "$MODO" in
  informe)
    informe
    ;;
  cron)
    mkdir -p "$LOGS"
    log="$LOGS/${nombre}-$(date +%F).log"
    estado=0
    informe >"$log" 2>&1 || estado=$?
    if (( estado == 1 )) && [[ -n "$MAIL" ]] && command -v mail >/dev/null; then
      mail -s "[Proxmox] Pools por encima de la cuota\${CLASE:+ ($CLASE)}" "$MAIL" <"$log"
    fi
    ;;
  instalar)
    [[ $EUID -eq 0 ]] || { echo "Ejecuta como root." >&2; exit 1; }
    [[ -f "$0" ]] || { echo "Guarda el script en un fichero antes de instalarlo." >&2; exit 1; }
    install -m 0750 "$0" "$DESTINO"
    echo "0 7 * * * root $DESTINO --cron\${MAIL:+ --mail $MAIL}" >"$CRON"
    echo "✔ Instalado: informe diario a las 07:00 en $LOGS/"
    if [[ -n "$MAIL" ]]; then echo "✔ Se enviará un correo a $MAIL cuando alguien supere la cuota."; fi
    ;;
  desinstalar)
    rm -f "$CRON" "$DESTINO"
    echo "✔ Cron de auditoría eliminado."
    ;;
esac
`;
}
