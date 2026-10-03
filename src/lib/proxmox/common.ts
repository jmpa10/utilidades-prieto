/**
 * Bloque bash compartido por los scripts generados: argumentos, colores,
 * mensajes y consultas a Proxmox. Se inserta tal cual (sin interpolar).
 */
export const CABECERA_COMUN = String.raw`
# Pegado desde la web: el fichero temporal se borra ya (bash lo sigue leyendo abierto).
if [[ "${"$"}{UP_AUTOBORRAR:-}" == 1 ]]; then rm -f -- "$0"; fi

DRY_RUN=0
SI_A_TODO=0
ACCION=""
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --yes|-y) SI_A_TODO=1 ;;
    -h|--help) sed -n '2,14p' "$0"; exit 0 ;;
    -*) echo "Opción desconocida: $arg" >&2; exit 2 ;;
    *)
      if [[ -n "$ACCION" ]]; then echo "Sobra el argumento: $arg" >&2; exit 2; fi
      ACCION="$arg" ;;
  esac
done

if [[ -t 1 ]]; then
  C_OK=$'\e[32m'; C_W=$'\e[33m'; C_E=$'\e[31m'; C_B=$'\e[1m'; C_D=$'\e[2m'; C_0=$'\e[0m'
else
  C_OK=''; C_W=''; C_E=''; C_B=''; C_D=''; C_0=''
fi
titulo() { printf '\n%s== %s ==%s\n' "$C_B" "$*" "$C_0"; }
ok()     { printf '  %s✔%s %s\n' "$C_OK" "$C_0" "$*"; }
info()   { printf '  %s·%s %s\n' "$C_D" "$C_0" "$*"; }
aviso()  { printf '  %s!%s %s\n' "$C_W" "$C_0" "$*"; }
error()  { printf '  %s✘%s %s\n' "$C_E" "$C_0" "$*" >&2; }
fallo()  { error "$*"; exit 1; }

# run <comando…>: lo ejecuta o, con --dry-run, solo lo muestra.
run() {
  if (( DRY_RUN )); then
    printf '  %s[simulación]%s' "$C_D" "$C_0"; printf ' %q' "$@"; printf '\n'
  else
    "$@"
  fi
}

# ids <usuario|group|pool|role> <campo>: lista de identificadores, uno por línea.
ids() {
  pveum "$1" list --output-format json | python3 -c '
import json, sys
campo = sys.argv[1]
for x in json.load(sys.stdin):
    print(x.get(campo, ""))
' "$2"
}

# existe <lista> <valor>
existe() { grep -qxF -- "$2" <<<"$1"; }

cargar_estado() {
  POOLS=$(ids pool poolid)
  USERS=$(ids user userid)
  GRUPOS=$(ids group groupid)
  ROLES=$(ids role roleid)
}

# version_minima <mayor> <menor>
version_minima() {
  local v
  v=$(pveversion | sed -n 's|.*pve-manager/\([0-9]*\)\.\([0-9]*\).*|\1 \2|p')
  read -r mayor menor <<<"$v"
  (( mayor > $1 || (mayor == $1 && menor >= $2) ))
}

comprobar_entorno() {
  [[ $EUID -eq 0 ]] || fallo "Ejecuta este script como root en un nodo Proxmox."
  command -v pveum >/dev/null || fallo "No encuentro 'pveum': ¿estás en un nodo Proxmox VE?"
  command -v python3 >/dev/null || fallo "Falta python3."
  cargar_estado
}

# miembros <pool>: imprime «tipo nodo id» por miembro (qemu, lxc o storage).
miembros() {
  { pvesh get /pools --poolid "$1" --output-format json 2>/dev/null \
      || pvesh get "/pools/$1" --output-format json 2>/dev/null \
      || echo '{}'; } | python3 -c '
import json, sys
d = json.load(sys.stdin)
if isinstance(d, list):
    d = d[0] if d else {}
vistos = set()
for m in d.get("members", []):
    t = m.get("type")
    if t in ("qemu", "lxc"):
        print(t, m.get("node"), m.get("vmid"))
    elif t == "storage" and m.get("storage") not in vistos:
        vistos.add(m.get("storage"))
        print("storage", "-", m.get("storage"))
'
}

# confirmar <palabra>: pide escribirla antes de algo que no se puede deshacer.
confirmar() {
  if (( DRY_RUN || SI_A_TODO )); then return 0; fi
  [[ -t 0 ]] || fallo "Sin terminal para confirmar: ejecuta con --yes si estás seguro."
  printf '\n%sEsta acción no se puede deshacer.%s Escribe «%s» para continuar: ' "$C_E" "$C_0" "$1"
  local respuesta
  read -r respuesta
  [[ "$respuesta" == "$1" ]] || fallo "Cancelado."
}

# destruir_vm <tipo> <nodo> <vmid>: la para y la destruye con sus discos.
destruir_vm() {
  run pvesh create "/nodes/$2/$1/$3/status/stop" >/dev/null 2>&1 || true
  run pvesh delete "/nodes/$2/$1/$3" --purge 1 --destroy-unreferenced-disks 1
}

# vms_objetivo <pools> <filtro> <etiqueta>: máquinas (no plantillas) de esos pools.
# <pools> va separado por comas; si un elemento acaba en «/», es toda la clase.
# Imprime «tipo nodo vmid estado pool nombre» por máquina.
vms_objetivo() {
  pvesh get /cluster/resources --type vm --output-format json | python3 -c '
import json, sys
pools = [p for p in sys.argv[1].split(",") if p]
filtro, etiqueta = sys.argv[2].lower(), sys.argv[3].lower()
def en_pools(p):
    return any(p == x or (x.endswith("/") and p.startswith(x)) for x in pools)
for r in sorted(json.load(sys.stdin), key=lambda r: (r.get("pool") or "", r.get("vmid", 0))):
    pool, nombre = r.get("pool") or "", r.get("name") or ""
    if r.get("template") or not en_pools(pool):
        continue
    if filtro and filtro not in nombre.lower():
        continue
    tags = [t.strip().lower() for t in (r.get("tags") or "").replace(",", ";").split(";") if t.strip()]
    if etiqueta and etiqueta not in tags:
        continue
    print(r["type"], r["node"], r["vmid"], r.get("status", "?"), pool, nombre or "-")
' "$1" "$2" "$3"
}

# pools_objetivo <pools>: pools de alumno que existen y coinciden (para informes).
pools_objetivo() {
  python3 -c '
import sys
pools = [p for p in sys.argv[1].split(",") if p]
for linea in sys.stdin.read().split():
    if any(linea == x or (x.endswith("/") and linea.startswith(x)) for x in pools):
        print(linea)
' "$1" <<<"$POOLS"
}

# Tareas en paralelo: lanzar <comando…> y, al final, terminar_paralelo.
MAX_PARALELO=8
FALLOS=""
lanzar() {
  if (( DRY_RUN )); then
    # Las funciones propias (destruir_vm…) ya muestran sus comandos con run.
    if declare -F "$1" >/dev/null; then "$@"; else run "$@"; fi
    return 0
  fi
  if [[ -z "$FALLOS" ]]; then
    FALLOS=$(mktemp); ERRLOG=$(mktemp)
    trap 'rm -f "$FALLOS" "$ERRLOG"' EXIT
  fi
  ( "$@" >/dev/null 2>>"$ERRLOG" || echo "$*" >>"$FALLOS" ) &
  while (( $(jobs -rp | wc -l) >= MAX_PARALELO )); do sleep 0.2; done
}
terminar_paralelo() {
  wait
  if [[ -n "$FALLOS" && -s "$FALLOS" ]]; then
    error "Fallaron $(wc -l <"$FALLOS" | tr -d ' ') tarea(s):"
    sed 's/^/      /' "$FALLOS" >&2
    sed 's/^/      /' "$ERRLOG" >&2
    return 1
  fi
}
`;
