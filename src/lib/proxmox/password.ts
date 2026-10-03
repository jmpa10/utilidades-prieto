import { q } from '../shell';
import { CABECERA_COMUN } from './common';
import { cabecera } from './objetivo';

export interface OpcionesPassword {
  usuarios: { userid: string; password: string }[];
  fecha?: Date;
}

export function scriptPassword(o: OpcionesPassword): string {
  const n = o.usuarios.length;
  return `${cabecera(
    'Restablecer contraseñas',
    [`${n} usuario${n === 1 ? '' : 's'}`, '⚠  Contiene contraseñas en claro: bórralo al terminar.'],
    'bash contrasenas.sh [--dry-run]',
    o.fecha,
  )}${CABECERA_COMUN}
comprobar_entorno

titulo "Restableciendo contraseñas"
(( DRY_RUN )) && aviso "Modo simulación: no se cambia nada."
CAMBIADAS=0; ERRORES=0

# cambiar <usuario> <contraseña>
cambiar() {
  if ! existe "$USERS" "$1"; then
    error "$1 no existe"
    ERRORES=$((ERRORES + 1))
    return
  fi
  if (( DRY_RUN )); then
    printf '  %s[simulación]%s pvesh set /access/password --userid %s --password ********\\n' "$C_D" "$C_0" "$1"
  elif ! pvesh set /access/password --userid "$1" --password "$2" >/dev/null; then
    error "no se pudo cambiar la de $1"
    ERRORES=$((ERRORES + 1))
    return
  fi
  ok "$1"
  CAMBIADAS=$((CAMBIADAS + 1))
}

${o.usuarios.map((u) => `cambiar ${q(u.userid)} ${q(u.password)}`).join('\n')}

titulo "Resumen"
ok "Cambiadas: $CAMBIADAS"
if (( ERRORES )); then
  error "Errores: $ERRORES"
  exit 1
fi
`;
}
