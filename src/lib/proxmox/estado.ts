import { q } from '../shell';
import { CABECERA_COMUN } from './common';
import { cabecera, describirObjetivo, variablesObjetivo, type Objetivo } from './objetivo';

const PYTHON = String.raw`
import json, re, subprocess, sys

clase, objetivo, realm = sys.argv[1], [p for p in sys.argv[2].split(",") if p], sys.argv[3]
GB = 1024 ** 3

def json_de(*cmd):
    return json.loads(subprocess.run(list(cmd) + ["--output-format", "json"], capture_output=True, text=True, check=True).stdout)

def en_objetivo(p):
    return any(p == x or (x.endswith("/") and p.startswith(x)) for x in objetivo)

recursos = [r for r in json_de("pvesh", "get", "/cluster/resources", "--type", "vm") if not r.get("template")]
pools = {p["poolid"]: p.get("comment") or "" for p in json_de("pveum", "pool", "list")}
usuarios = [u["userid"] for u in json_de("pveum", "user", "list")]
alumnos = sorted(p for p in pools if p != clase and en_objetivo(p))

filas, sin_vms = [], []
tot_vms = tot_on = tot_ram = tot_cpu = 0
for pool in alumnos:
    vms = [r for r in recursos if r.get("pool") == pool]
    on = [r for r in vms if r.get("status") == "running"]
    ram = sum(r.get("maxmem", 0) for r in on) / GB
    cpu = sum(r.get("maxcpu", 0) for r in on)
    disco = sum(r.get("maxdisk", 0) for r in vms) / GB
    m = re.search(r"quota=(\d+(?:\.\d+)?)G", pools[pool])
    cuota = ("%.0f" % float(m.group(1))) if m else "-"
    nombres = ", ".join("%s%s" % (r.get("name") or r["vmid"], "*" if r.get("status") == "running" else "") for r in vms)
    filas.append((pool.split("/", 1)[-1], len(vms), len(on), ram, cpu, disco, cuota, nombres or "-"))
    if not vms:
        sin_vms.append(pool)
    tot_vms += len(vms); tot_on += len(on); tot_ram += ram; tot_cpu += cpu

if not filas:
    print("No hay pools de alumno que coincidan.")
    sys.exit(0)

print("%-24s %4s %4s %8s %5s %13s  %s" % ("ALUMNO", "VMs", "ON", "RAM ON", "vCPU", "DISCO/CUOTA", "MÁQUINAS (* encendida)"))
print("-" * 100)
for alumno, n, on, ram, cpu, disco, cuota, nombres in filas:
    print("%-24s %4d %4d %7.1fG %5d %7.0f/%-5s  %s" % (alumno, n, on, ram, cpu, disco, cuota, nombres))
print("-" * 100)
print("%d alumno(s) · %d máquina(s) · %d encendida(s) · %.1f GB de RAM y %d vCPU en uso" % (len(filas), tot_vms, tot_on, tot_ram, tot_cpu))
if sin_vms:
    print("\nSin ninguna máquina: " + ", ".join(p.split("/", 1)[-1] for p in sin_vms))
if any(x.endswith("/") for x in objetivo):
    sin_pool = [u for u in usuarios if u.endswith("-%s@%s" % (clase, realm)) and "%s/%s" % (clase, u.split("@")[0]) not in pools]
    if sin_pool:
        print("Usuarios de la clase sin pool: " + ", ".join(sin_pool))
print("Disco: tamaño aproximado del disco principal de cada máquina. Para la cuota exacta usa «Uso de disco».")
`;

export function scriptEstado(o: Objetivo & { realm: string; fecha?: Date }): string {
  return `${cabecera('Estado de la clase', [`Alcance: ${describirObjetivo(o)}`, 'Solo lee: no cambia nada.'], 'bash estado.sh', o.fecha)}
${variablesObjetivo(o)}
REALM=${q(o.realm)}
${CABECERA_COMUN}
comprobar_entorno

titulo "Estado de $CLASE"
python3 - "$CLASE" "$OBJETIVO" "$REALM" <<'PY'
${PYTHON.trim()}
PY
`;
}
