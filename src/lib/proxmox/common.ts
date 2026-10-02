/**
 * Bloque bash compartido por los scripts generados: argumentos, colores,
 * mensajes y consultas a Proxmox. Se inserta tal cual (sin interpolar).
 */
export const CABECERA_COMUN = String.raw`
# Pegado desde la web: el fichero temporal se borra ya (bash lo sigue leyendo abierto).
if [[ "${"$"}{UP_AUTOBORRAR:-}" == 1 ]]; then rm -f -- "$0"; fi

DRY_RUN=0
SI_A_TODO=0
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=1 ;;
    --yes|-y) SI_A_TODO=1 ;;
    -h|--help) sed -n '2,12p' "$0"; exit 0 ;;
    *) echo "Opción desconocida: $arg" >&2; exit 2 ;;
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
`;
