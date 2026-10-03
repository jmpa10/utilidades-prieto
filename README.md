<p align="center"><img src="public/img/logo-iesgp-192.png" alt="Logo del IES Gregorio Prieto" width="120"></p>

# Utilidades Prieto

Portal de utilidades del **Departamento de Informática del IES Gregorio Prieto** para el profesorado. Es un proyecto de código abierto pensado para que otros centros puedan reutilizarlo, creado por [@jmpa10](https://github.com/jmpa10). La primera utilidad genera los scripts para **crear y borrar en lote usuarios y pools de Proxmox VE**, uno por alumno y agrupados por clase.

La web es **estática**: todo se calcula en el navegador y no se envía ni se guarda ningún nombre ni contraseña. El profesor descarga el script y lo ejecuta en un nodo de Proxmox.

## Qué hace el módulo de Proxmox

Cada clase es un pool, y dentro cada alumno tiene su propio pool, donde solo él ve sus máquinas. Para la clase «2º ASIR» (bridge `vmbr2asir`) y el alumno «Pérez García, Juan»:

| Elemento | Nombre | Permisos |
|---|---|---|
| Pool de la clase | `2asir` | Los profesores de la clase (`PVEVMAdmin`, `PVEPoolUser`, `PVEDatastoreUser`), que se propaga a los pools de los alumnos |
| Pool del alumno | `2asir/jperez-2asir` | Comentario `quota=50G; Juan Pérez García`. Incluye el storage de discos (`ssd-vms`) |
| Usuario | `jperez-2asir@pve` | Contraseña aleatoria y rol `Alumno` **solo sobre su pool** |
| Grupo de la clase | `2asir` | `PVESDNUser` sobre su bridge, `AlumnoISO` (solo lectura) sobre `isos-hdd` y `PVETemplateUser` sobre el pool de plantillas |
| Profesores | `profe1@pve`… | Además, `PVEDatastoreUser` sobre `isos-hdd` para subir ISOs |

Antes de la primera clase, pega una vez el bloque **Preparar Proxmox** (página de resumen de Proxmox). Crea el rol `Alumno` (crear, configurar, encender, parar y borrar máquinas en su pool) y `AlumnoISO`.

- **Crear** (`/proxmox/crear/`): desde un TXT `Apellidos, Nombre` o de uno en uno (también vale para profesores, sin clase). Al generar el script de una clase se descarga un **resumen .txt** con los usuarios, pools y contraseñas creados. También puedes descargar las credenciales en CSV o imprimir papeletas.
- **Borrar** (`/proxmox/borrar/`): una clase entera (la busca en el servidor), desde el resumen .txt (respeta los usuarios aunque se editaran a mano) o desde la lista original, o un usuario suelto. Para y destruye las VMs/CTs del pool.
- **Mover alumno** (`/proxmox/mover/`): pasa a un alumno a otra clase. Proxmox no permite renombrar usuarios, así que recibe uno nuevo (`jperez-2dam`) con contraseña nueva y se lleva sus máquinas.
- **Profesores** (`/proxmox/profesores/`): añade o quita profesores de una clase ya creada.

**En el aula** (toda la clase, algunos alumnos o las máquinas que coincidan con un nombre o una etiqueta):

- **Encender y apagar** (`/proxmox/energia/`): apagado ordenado, que se fuerza tras una espera, o encendido, en paralelo.
- **Snapshots** (`/proxmox/snapshots/`): crear, ver, volver o borrar un snapshot con nombre en todas las máquinas.
- **Repartir plantilla** (`/proxmox/repartir/`): una copia completa de una plantilla en el pool de cada alumno (`debian-jperez`…), con el siguiente VMID libre. No duplica si se repite.
- **Recoger prácticas** (`/proxmox/recoger/`): snapshot `entrega-<práctica>` en cada máquina y lista de quién no ha entregado.
- **Limpiar práctica** (`/proxmox/limpiar/`): destruye las máquinas de una práctica terminada. El filtro es obligatorio.

**Seguimiento:**

- **Estado de la clase** (`/proxmox/estado/`): por alumno, sus máquinas, cuáles están encendidas, RAM, vCPU y disco frente a la cuota, y quién no tiene ninguna.
- **Contraseñas** (`/proxmox/contrasenas/`): contraseñas nuevas para uno o varios alumnos (o toda la clase con su resumen .txt), con papeletas.
- **Uso de disco** (`/proxmox/auditoria/`): LVM-thin no permite cuotas, así que la cuota se anota en el pool y este script avisa de quién la supera. Se puede instalar como cron diario.

Cada script se puede usar de dos formas:

- **Pegar en la terminal** (por defecto): se copia un bloque y se pega en la Shell del nodo (web de Proxmox → nodo → *Shell*, o SSH como root). El bloque vuelca el script en un fichero temporal, lo ejecuta en un proceso aparte (un error no cierra tu sesión) y lo borra. Desactiva la expansión de `!` y no deja las contraseñas en el historial. Primero se pega la versión «Simular» y después la real.
- **Fichero .sh**: se descarga, se copia al nodo y se ejecuta con `bash fichero.sh [--dry-run]`.

Todos admiten `--dry-run` y se pueden repetir sin duplicar nada: si la clase o sus pools ya existen, se reutilizan. Al borrar una clase entera también se quitan sus permisos.

## Reutilizarlo en tu centro

1. Haz un fork de [jmpa10/utilidades-prieto](https://github.com/jmpa10/utilidades-prieto).
2. Cambia los datos de [`src/lib/centro.ts`](src/lib/centro.ts) (nombre del centro, departamento, logo, autor y repositorio) y pon tu logo en `public/img/`.
3. Despliégalo como se explica abajo. Los valores de Proxmox (rol, realm, storages de discos e ISOs, pool de plantillas, roles de profesor, cuota, URL) se ajustan desde la página de Ajustes de la propia web.

Se agradecen mejoras y nuevas utilidades mediante *issues* o *pull requests*.

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:4321
npm test         # pruebas, incluidas las que ejecutan los scripts contra un Proxmox simulado
npm run build    # genera dist/
```

Estructura:

```
src/lib/names.ts            nombres → usuarios (tildes, partículas, coincidencias)
src/lib/passwords.ts        contraseñas con crypto.getRandomValues
src/lib/proxmox/*.ts        generadores de los scripts bash
src/components/*.tsx        formularios (islas Preact)
src/pages/                  una carpeta por utilidad
src/lib/navegacion.ts       menú del portal
tests/mock/pve.py           pveum/pvesh/pveversion simulados para las pruebas
```

### Añadir una utilidad nueva (p. ej. Dokploy)

1. Crea las páginas en `src/pages/dokploy/`, usando `layouts/Portal.astro`.
2. Pon la lógica en `src/lib/dokploy/` con sus pruebas en `tests/`.
3. Añade la sección y sus enlaces en `src/lib/navegacion.ts` (quita `pronto: true`).

## Despliegue

La imagen Docker compila el sitio (antes pasa las pruebas) y lo sirve con Nginx en el puerto 80.

**Con Dokploy (recomendado, se actualiza solo):**

1. Sube el repositorio a GitHub.
2. En Dokploy: *Create Application* → origen GitHub → este repositorio, rama `main` → *Build type: Dockerfile*.
3. Activa *Autodeploy*. Cada `git push` a `main` vuelve a publicar la web.
4. Asigna el dominio interno en Dokploy o apunta a él desde el Nginx inverso del centro.

**Sin Dokploy, en una VM con Docker:**

```bash
git clone https://github.com/jmpa10/utilidades-prieto.git && cd utilidades-prieto
docker compose up -d --build          # queda en http://<vm>:8080
# Para actualizar:
git pull && docker compose up -d --build
```

En el Nginx inverso:

```nginx
location / {
    proxy_pass http://IP_DE_LA_VM:8080;
    proxy_set_header Host $host;
}
```

Si quieres que solo entre el profesorado, añade `auth_basic` en el proxy inverso o publícala solo en la red interna.

## Licencia

[MIT](LICENSE): puedes usarlo, modificarlo y redistribuirlo libremente manteniendo el aviso de copyright.
