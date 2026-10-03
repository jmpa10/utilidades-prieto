import { comentario, q } from '../shell';
import { CABECERA_COMUN } from './common';
import { cabecera } from './objetivo';

export interface OpcionesProfesores {
  clase: string;
  profesores: string[];
  rolesProfesor: string;
  storageIsos: string;
  fecha?: Date;
}

export function scriptProfesores(o: OpcionesProfesores): string {
  return `${cabecera(
    'Profesores de una clase',
    [`Clase: ${o.clase}`, `Profesores: ${o.profesores.map(comentario).join(', ')}`],
    'bash profesores.sh anadir|quitar [--dry-run]',
    o.fecha,
  )}
CLASE=${q(o.clase)}
ROLES_PROFESOR=${q(o.rolesProfesor)}
STORAGE_ISOS=${q(o.storageIsos)}
PROFESORES=(${o.profesores.map(q).join(' ')})
${CABECERA_COMUN}
comprobar_entorno

case "$ACCION" in
  anadir|quitar) ;;
  *) fallo "Indica qué hacer: anadir o quitar." ;;
esac
existe "$POOLS" "$CLASE" || fallo "La clase $CLASE no existe: créala antes."

titulo "$( [[ "$ACCION" == anadir ]] && echo "Añadiendo" || echo "Quitando" ) profesores de $CLASE"
(( DRY_RUN )) && aviso "Modo simulación: no se cambia nada."
for prof in "\${PROFESORES[@]}"; do
  if ! existe "$USERS" "$prof"; then
    aviso "$prof no existe en Proxmox: se salta."
    continue
  fi
  if [[ "$ACCION" == anadir ]]; then
    run pveum acl modify "/pool/$CLASE" --users "$prof" --roles "$ROLES_PROFESOR"
    if [[ -n "$STORAGE_ISOS" ]]; then
      run pveum acl modify "/storage/$STORAGE_ISOS" --users "$prof" --roles PVEDatastoreUser
    fi
    ok "$prof ve y gestiona la clase $CLASE"
  else
    # El permiso de subir ISOs se mantiene: puede necesitarlo en otras clases.
    run pveum acl delete "/pool/$CLASE" --users "$prof" --roles "$ROLES_PROFESOR"
    ok "$prof ya no tiene acceso a $CLASE"
  fi
done
`;
}
