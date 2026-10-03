import { comentario, q } from '../shell';
import { poolDe, usuarioCompleto } from '../names';
import { CABECERA_COMUN } from './common';
import { cabecera } from './objetivo';

export interface OpcionesMover {
  realm: string;
  rol: string;
  claseOrigen: string;
  baseOrigen: string;
  claseDestino: string;
  baseDestino: string;
  password: string;
  fecha?: Date;
}

export function scriptMover(o: OpcionesMover): string {
  const viejo = `${usuarioCompleto(o.baseOrigen, o.claseOrigen)}@${o.realm}`;
  const nuevo = `${usuarioCompleto(o.baseDestino, o.claseDestino)}@${o.realm}`;
  return `${cabecera(
    'Mover alumno de clase',
    [`${comentario(viejo)} → ${comentario(nuevo)}`, '⚠  Contiene la contraseña nueva: bórralo al terminar.'],
    'bash mover.sh [--dry-run]',
    o.fecha,
  )}
REALM=${q(o.realm)}
ROL=${q(o.rol)}
DESTINO=${q(o.claseDestino)}
VIEJO=${q(viejo)}
NUEVO=${q(nuevo)}
POOL_VIEJO=${q(poolDe(o.baseOrigen, o.claseOrigen))}
POOL_NUEVO=${q(poolDe(o.baseDestino, o.claseDestino))}
PASS=${q(o.password)}
${CABECERA_COMUN}
comprobar_entorno

existe "$USERS" "$VIEJO" || fallo "El usuario $VIEJO no existe."
existe "$USERS" "$NUEVO" && fallo "El usuario $NUEVO ya existe."
existe "$POOLS" "$DESTINO" || fallo "La clase $DESTINO no existe: créala antes con «Crear usuarios»."
existe "$GRUPOS" "$DESTINO" || fallo "El grupo $DESTINO no existe: créala antes con «Crear usuarios»."
existe "$ROLES" "$ROL" || fallo "El rol '$ROL' no existe."
existe "$POOLS" "$POOL_NUEVO" && fallo "El pool $POOL_NUEVO ya existe."

# Comentarios que se conservan (cuota del pool y nombre del alumno).
COMENTARIO_POOL=$(pveum pool list --output-format json | python3 -c '
import json, sys
print(next((p.get("comment") or "" for p in json.load(sys.stdin) if p["poolid"] == sys.argv[1]), ""))' "$POOL_VIEJO")
COMENTARIO_USUARIO=$(pveum user list --output-format json | python3 -c '
import json, sys
print(next((u.get("comment") or "" for u in json.load(sys.stdin) if u["userid"] == sys.argv[1]), ""))' "$VIEJO")

IDS=""; STORAGES=()
if existe "$POOLS" "$POOL_VIEJO"; then
  while read -r tipo nodo id; do
    [[ -n "$tipo" ]] || continue
    if [[ "$tipo" == storage ]]; then STORAGES+=("$id"); else IDS+="\${IDS:+,}$id"; fi
  done < <(miembros "$POOL_VIEJO")
fi

titulo "Moviendo $VIEJO → $NUEVO"
(( DRY_RUN )) && aviso "Modo simulación: no se cambia nada."

run pveum pool add "$POOL_NUEVO" --comment "$COMENTARIO_POOL"
for st in \${STORAGES[@]+"\${STORAGES[@]}"}; do
  run pveum pool modify "$POOL_NUEVO" --storage "$st"
done
ok "pool $POOL_NUEVO"

if [[ -n "$IDS" ]]; then
  if ! run pvesh set /pools --poolid "$POOL_NUEVO" --vms "$IDS" --allow-move 1 2>/dev/null; then
    run pveum pool modify "$POOL_VIEJO" --vms "$IDS" --delete 1
    run pveum pool modify "$POOL_NUEVO" --vms "$IDS"
  fi
  ok "máquinas movidas: $IDS"
fi

if (( DRY_RUN )); then
  printf '  %s[simulación]%s pveum user add %s --password ******** --groups %s\\n' "$C_D" "$C_0" "$NUEVO" "$DESTINO"
else
  pveum user add "$NUEVO" --password "$PASS" --groups "$DESTINO" --comment "$COMENTARIO_USUARIO"
fi
run pveum acl modify "/pool/$POOL_NUEVO" --users "$NUEVO" --roles "$ROL"
ok "usuario $NUEVO con rol $ROL sobre su pool"

run pveum user delete "$VIEJO"
if existe "$POOLS" "$POOL_VIEJO"; then
  for st in \${STORAGES[@]+"\${STORAGES[@]}"}; do
    run pveum pool modify "$POOL_VIEJO" --storage "$st" --delete 1
  done
  run pveum pool delete "$POOL_VIEJO"
fi
ok "borrados $VIEJO y $POOL_VIEJO"

titulo "Hecho"
info "Dale al alumno su usuario nuevo: $NUEVO"
`;
}
