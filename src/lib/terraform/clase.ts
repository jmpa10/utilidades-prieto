import { fechaHora } from '../shell';
import type { OpcionesCreacion } from '../proxmox/create';
import { alinear, cadena, comentarioHcl, lista } from './hcl';

/** Versión del provider bpg/proxmox con la que se han probado los ficheros. */
export const VERSION_PROVIDER = '0.116';

export interface OpcionesProyecto extends OpcionesCreacion {
  /** URL de la API de Proxmox («https://pve.centro:8006/»). */
  endpoint: string;
}

/** Ficheros del proyecto (nombre → contenido), en el orden en que conviene leerlos. */
export type Proyecto = Record<string, string>;

const VERSIONS_TF = `terraform {
  required_version = ">= 1.5"
  required_providers {
    proxmox = {
      source  = "bpg/proxmox"
      version = "~> ${VERSION_PROVIDER}"
    }
  }
}

# Las credenciales van en variables de entorno, nunca en estos ficheros:
#   export PROXMOX_VE_API_TOKEN='terraform@pve!web=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx'
# o, si el token no basta, usuario y contraseña:
#   export PROXMOX_VE_USERNAME='root@pam' PROXMOX_VE_PASSWORD='...'
provider "proxmox" {
  endpoint = var.endpoint
  insecure = var.insecure
}
`;

const VARIABLES_TF = `variable "endpoint" {
  description = "URL de la API de Proxmox, p. ej. https://pve.centro:8006/"
  type        = string
}

variable "insecure" {
  description = "Acepta el certificado autofirmado de Proxmox."
  type        = bool
  default     = true
}

variable "realm" {
  description = "Realm de los usuarios (pve: usuarios propios de Proxmox)."
  type        = string
  default     = "pve"
}

variable "clase" {
  description = "Identificador (pool y grupo) y nombre legible de la clase."
  type = object({
    id     = string
    nombre = string
  })
  validation {
    condition     = can(regex("^[a-z][a-z0-9_-]*$", var.clase.id))
    error_message = "El identificador de la clase debe empezar por una letra (Proxmox no admite pools como «2asir»): usa, por ejemplo, «asir2»."
  }
}

variable "rol" {
  description = "Rol de cada alumno sobre su pool. Debe existir: se crea con «Preparar Proxmox»."
  type        = string
  default     = "Alumno"
}

variable "cuota_gb" {
  description = "Espacio por alumno. Se anota en el comentario del pool y lo revisa «Uso de disco»."
  type        = number
  default     = null
}

variable "storage" {
  description = "Storage de discos que se añade al pool de cada alumno (vacío: ninguno)."
  type        = string
  default     = ""
}

variable "storage_isos" {
  description = "Storage de ISOs: la clase puede usarlas y los profesores subirlas (vacío: ninguno)."
  type        = string
  default     = ""
}

variable "bridge" {
  description = "Bridge de la clase: solo su grupo puede conectar máquinas a él (vacío: ninguno)."
  type        = string
  default     = ""
}

variable "pool_plantillas" {
  description = "Pool común de plantillas que la clase puede clonar. Debe existir (vacío: ninguno)."
  type        = string
  default     = ""
}

variable "profesores" {
  description = "Usuarios de Proxmox de los profesores de la clase. Deben existir."
  type        = list(string)
  default     = []
}

variable "roles_profesor" {
  description = "Roles de los profesores sobre el pool de la clase."
  type        = list(string)
  default     = ["PVEVMAdmin", "PVEPoolUser", "PVEDatastoreUser"]
}

variable "alumnos" {
  description = "Alumnos de la clase: usuario (sin la clase) => nombre y contraseña inicial."
  type = map(object({
    nombre   = string
    password = string
  }))
  validation {
    condition     = alltrue([for base in keys(var.alumnos) : can(regex("^[a-z0-9][a-z0-9_-]*$", base))])
    error_message = "Cada usuario lleva solo minúsculas, números, - y _."
  }
}
`;

const MAIN_TF = `locals {
  alumnos = {
    for base, a in var.alumnos : base => {
      usuario  = "\${base}-\${var.clase.id}"
      pool     = "\${var.clase.id}/\${base}-\${var.clase.id}"
      nombre   = a.nombre
      password = a.password
    }
  }
  # Un permiso por profesor y rol.
  profesor_roles = {
    for par in setproduct(var.profesores, var.roles_profesor) : "\${par[0]} \${par[1]}" => {
      usuario = par[0]
      rol     = par[1]
    }
  }
}

# ── Clase: grupo y pool padre ────────────────────────────────

resource "proxmox_virtual_environment_group" "clase" {
  group_id = var.clase.id
  comment  = "Clase \${var.clase.nombre}"
}

resource "proxmox_virtual_environment_pool" "clase" {
  pool_id = var.clase.id
  comment = "Clase \${var.clase.nombre}"
}

# Red: solo el grupo de la clase puede conectar máquinas a su bridge.
resource "proxmox_acl" "bridge" {
  count     = var.bridge == "" ? 0 : 1
  path      = "/sdn/zones/localnetwork/\${var.bridge}"
  group_id  = proxmox_virtual_environment_group.clase.group_id
  role_id   = "PVESDNUser"
  propagate = true
}

# ISOs: la clase puede montarlas, pero no subir ni borrar.
resource "proxmox_acl" "isos" {
  count     = var.storage_isos == "" ? 0 : 1
  path      = "/storage/\${var.storage_isos}"
  group_id  = proxmox_virtual_environment_group.clase.group_id
  role_id   = "AlumnoISO"
  propagate = true
}

# Plantillas: la clase puede clonarlas en su propio pool.
resource "proxmox_acl" "plantillas" {
  count     = var.pool_plantillas == "" ? 0 : 1
  path      = "/pool/\${var.pool_plantillas}"
  group_id  = proxmox_virtual_environment_group.clase.group_id
  role_id   = "PVETemplateUser"
  propagate = true
}

# Profesores: ven y gestionan todo el pool de la clase (se propaga a los alumnos)…
resource "proxmox_acl" "profesor" {
  for_each  = local.profesor_roles
  path      = "/pool/\${proxmox_virtual_environment_pool.clase.pool_id}"
  user_id   = each.value.usuario
  role_id   = each.value.rol
  propagate = true
}

# …y pueden subir ISOs.
resource "proxmox_acl" "profesor_isos" {
  for_each  = var.storage_isos == "" ? toset([]) : toset(var.profesores)
  path      = "/storage/\${var.storage_isos}"
  user_id   = each.key
  role_id   = "PVEDatastoreUser"
  propagate = true
}

# ── Alumnos: pool propio, usuario y rol sobre su pool ────────

resource "proxmox_virtual_environment_pool" "alumno" {
  for_each = local.alumnos
  # Hace referencia al pool de la clase para crearse después de él.
  pool_id = "\${proxmox_virtual_environment_pool.clase.pool_id}/\${each.value.usuario}"
  comment = var.cuota_gb == null ? each.value.nombre : "quota=\${var.cuota_gb}G; \${each.value.nombre}"
}

resource "proxmox_pool_membership" "storage" {
  for_each   = var.storage == "" ? {} : local.alumnos
  pool_id    = proxmox_virtual_environment_pool.alumno[each.key].pool_id
  storage_id = var.storage
}

resource "proxmox_virtual_environment_user" "alumno" {
  for_each = local.alumnos
  user_id  = "\${each.value.usuario}@\${var.realm}"
  password = each.value.password
  comment  = each.value.nombre
  groups   = [proxmox_virtual_environment_group.clase.group_id]
}

resource "proxmox_acl" "alumno" {
  for_each  = local.alumnos
  path      = "/pool/\${proxmox_virtual_environment_pool.alumno[each.key].pool_id}"
  user_id   = proxmox_virtual_environment_user.alumno[each.key].user_id
  role_id   = var.rol
  propagate = true
}

output "usuarios" {
  description = "Usuario de Proxmox de cada alumno y su pool."
  value       = { for a in local.alumnos : "\${a.usuario}@\${var.realm}" => a.pool }
}
`;

const GITIGNORE = `# Llevan las contraseñas de los alumnos: no los subas a ningún repositorio.
terraform.tfvars
*.tfstate
*.tfstate.*
.terraform/
crash.log
`;

export function tfvarsClase(o: OpcionesProyecto): string {
  const n = o.usuarios.length;
  const cabecera = `# Clase ${comentarioHcl(o.claseNombre || o.clase)} (${o.clase}) · ${n} alumno${n === 1 ? '' : 's'}
# Generado por Utilidades Prieto: ${fechaHora(o.fecha)}
# ⚠  Contiene contraseñas en claro, igual que terraform.tfstate. No los compartas.`;
  const roles = o.rolesProfesor.split(',').map((r) => r.trim()).filter(Boolean);
  const ajustes = alinear([
    ['endpoint', cadena(o.endpoint ? o.endpoint.replace(/\/*$/, '/') : 'https://IP_DEL_PROXMOX:8006/')],
    ['realm', cadena(o.realm)],
    ['rol', cadena(o.rol)],
    ['cuota_gb', o.cuotaGB ? String(o.cuotaGB) : 'null'],
    ['storage', cadena(o.storage)],
    ['storage_isos', cadena(o.storageIsos)],
    ['bridge', cadena(o.bridge)],
    ['pool_plantillas', cadena(o.poolPlantillas)],
    ['profesores', lista(o.profesores)],
    ['roles_profesor', lista(roles)],
  ]);
  const alumnos = n
    ? alinear(o.usuarios.map((u) => [cadena(u.base), `{ nombre = ${cadena(u.nombre)}, password = ${cadena(u.password)} }`]), '  ')
    : '';
  return `${cabecera}

clase = {
  id     = ${cadena(o.clase)}
  nombre = ${cadena(o.claseNombre || o.clase)}
}

${ajustes}

# Un alumno por línea: usuario (sin la clase) = nombre y contraseña inicial.
# Para dar de alta a alguien, añade su línea; para darlo de baja, quítala.
# Después: terraform plan (revisa) y terraform apply.
alumnos = {
${alumnos}
}
`;
}

function leeme(o: OpcionesProyecto): string {
  const c = o.clase;
  return `# Clase ${o.claseNombre || c} con Terraform

Proyecto generado por Utilidades Prieto. Crea en Proxmox lo mismo que el script
«Crear usuarios»: el grupo y el pool \`${c}\`, un pool, un usuario y su rol para
cada alumno (\`jperez-${c}@${o.realm}\` en \`${c}/jperez-${c}\`) y los permisos de la
clase (bridge, ISOs, plantillas y profesores).

## Antes de empezar (una sola vez)

1. Ejecuta **Preparar Proxmox** desde la web: crea los roles \`${o.rol}\` y \`AlumnoISO\`.
   Terraform no los gestiona porque los comparten todas las clases.
2. Instala Terraform (https://developer.hashicorp.com/terraform/install) u OpenTofu.
3. Crea un usuario y un token para Terraform. En la Shell de un nodo:

   \`\`\`bash
   pveum user add terraform@pve --comment "Terraform"
   pveum acl modify / --users terraform@pve --roles Administrator
   pveum user token add terraform@pve web --privsep 0
   \`\`\`

   Copia el valor del token: solo se muestra una vez. Tiene permisos de
   administrador (necesita crear usuarios y repartir permisos): guárdalo bien.

## Crear la clase

\`\`\`bash
export PROXMOX_VE_API_TOKEN='terraform@pve!web=EL-VALOR-DEL-TOKEN'
terraform init      # la primera vez: descarga el provider bpg/proxmox
terraform plan      # muestra lo que va a crear, sin tocar nada
terraform apply     # lo crea (pide confirmación)
\`\`\`

Revisa \`endpoint\` en \`terraform.tfvars\` si no apunta a vuestro Proxmox.

## Durante el curso

- **Alta o baja de un alumno:** añade o quita su línea en \`alumnos\` de
  \`terraform.tfvars\` y ejecuta \`terraform plan\` y \`terraform apply\`.
- **Profesores, bridge, ISOs…:** cambia su valor en \`terraform.tfvars\` y aplica.
- **Repartir una plantilla:** descarga el fichero \`repartir-….tf\` desde la web,
  déjalo en esta carpeta y aplica. Cada alumno recibe su copia (también los que
  se añadan después). Para retirarlas, borra el fichero y aplica.
- **Lo del día a día** (encender y apagar, snapshots, recoger prácticas,
  contraseñas, estado, uso de disco) se hace con los scripts de la web.

**Gestiona esta clase siempre desde aquí.** No uses con ella los scripts de
Mover alumno, Profesores ni Borrar usuarios: Terraform no se enteraría y en el
siguiente \`apply\` intentaría deshacer esos cambios.

## Final de curso

\`\`\`bash
terraform destroy
\`\`\`

Borra usuarios, pools, permisos y las copias repartidas. Las máquinas que los
alumnos hayan creado por su cuenta no son de Terraform: Proxmox no deja borrar un
pool con máquinas, así que bórralas antes (por ejemplo, con «Limpiar una práctica»).

## Contraseñas

\`terraform.tfvars\` y \`terraform.tfstate\` llevan las contraseñas en claro.
Guárdalos en un sitio privado y no los subas a ningún repositorio (el
\`.gitignore\` ya los excluye). Si borras \`terraform.tfstate\`, Terraform deja de
saber qué creó: guárdalo mientras dure el curso.
`;
}

export function proyectoClase(o: OpcionesProyecto): Proyecto {
  return {
    'LEEME.md': leeme(o),
    'terraform.tfvars': tfvarsClase(o),
    'main.tf': MAIN_TF,
    'variables.tf': VARIABLES_TF,
    'versions.tf': VERSIONS_TF,
    '.gitignore': GITIGNORE,
  };
}
