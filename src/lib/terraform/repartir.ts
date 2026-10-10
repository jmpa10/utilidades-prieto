import { fechaHora } from '../shell';
import type { OpcionesRepartir } from '../proxmox/repartir';
import { alinear, cadena, comentarioHcl, identificador, lista } from './hcl';

export function ficheroRepartir(prefijo: string): string {
  return `repartir-${prefijo}.tf`;
}

/**
 * Un .tf para dejar en la carpeta del proyecto Terraform de la clase: usa sus
 * alumnos (var.alumnos) y sus pools, así que los alumnos que se añadan después
 * también reciben su copia. Solo plantillas de máquinas virtuales (QEMU).
 */
export function tfRepartir(o: OpcionesRepartir): string {
  const id = identificador(o.prefijo);
  const plantilla = `plantilla_${id}`;
  const alumnos = `alumnos_${id}`;
  const porVmid = /^\d+$/.test(o.plantilla);
  const condicion = porVmid ? `vm.vm_id == ${o.plantilla}` : `vm.name == ${cadena(o.plantilla)}`;
  const quienes = o.bases.length
    ? `{ for base, a in local.alumnos : base => a if contains(${lista(o.bases)}, base) }`
    : 'local.alumnos';
  const clone: [string, string][] = [
    ['source_vm_id', `try(local.${plantilla}[0].vm_id, 0)`],
    ['full', 'true'],
    ['pool_id', 'proxmox_virtual_environment_pool.alumno[each.key].pool_id'],
  ];
  if (o.storage) clone.push(['target_datastore', cadena(o.storage)]);

  return `# Repartir la plantilla «${comentarioHcl(o.plantilla)}» → ${comentarioHcl(o.prefijo)}-<alumno>
# Alcance: ${o.bases.length ? `${o.bases.length} alumno${o.bases.length === 1 ? '' : 's'} (${o.bases.join(', ')})` : 'toda la clase, también quien se añada después'}
# Generado por Utilidades Prieto: ${fechaHora(o.fecha)}
#
# Déjalo en la carpeta del proyecto Terraform de la clase y ejecuta
# terraform plan y terraform apply. Para retirar las copias, borra este fichero y aplica.

data "proxmox_virtual_environment_vms" "${plantilla}" {
  filter {
    name   = "template"
    values = [true]
  }
}

locals {
${alinear([
    [plantilla, `[for vm in data.proxmox_virtual_environment_vms.${plantilla}.vms : vm if ${condicion}]`],
    [alumnos, quienes],
  ], '  ')}
}

resource "proxmox_cloned_vm" "${id}" {
  for_each  = local.${alumnos}
  node_name = try(local.${plantilla}[0].node_name, "")
  name      = "${o.prefijo}-\${each.key}"
  started   = ${o.encender}

  # Al retirarla se borra entera, discos incluidos.
  stop_on_destroy                      = true
  purge_on_destroy                     = true
  delete_unreferenced_disks_on_destroy = true

  clone = {
${alinear(clone, '    ')}
  }

  lifecycle {
    precondition {
      condition     = length(local.${plantilla}) == 1
      error_message = ${cadena(
        porVmid
          ? `No hay ninguna plantilla de máquina virtual con VMID ${o.plantilla}.`
          : `Debe haber una sola plantilla de máquina virtual llamada «${o.plantilla}»: si hay varias, usa su VMID.`,
      )}
    }
    # Los alumnos encienden y apagan sus máquinas: Terraform no lo deshace.
    ignore_changes = [started]
  }
}
`;
}
