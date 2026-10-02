<p align="center"><img src="public/img/logo-iesgp-192.png" alt="Logo del IES Gregorio Prieto" width="120"></p>

# Utilidades Prieto

Portal de utilidades del **Departamento de Informática del IES Gregorio Prieto** para el profesorado. Es un proyecto de código abierto pensado para que otros centros puedan reutilizarlo, creado por [@jmpa10](https://github.com/jmpa10). La primera utilidad genera los scripts para **crear y borrar en lote usuarios y pools de Proxmox VE**, uno por alumno y agrupados por clase.

La web es **estática**: todo se calcula en el navegador y no se envía ni se guarda ningún nombre ni contraseña. El profesor descarga el script y lo ejecuta en un nodo de Proxmox.

## Qué hace el módulo de Proxmox

Para la clase «2º ASIR» y el alumno «Pérez García, Juan»:

| Elemento | Nombre | Notas |
|---|---|---|
| Grupo | `2asir` | Todos los alumnos de la clase |
| Pool de la clase | `2asir` | Contiene los pools de los alumnos (pools anidados, PVE ≥ 8.1) |
| Pool del alumno | `2asir/jperez-2asir` | Comentario `quota=50G; Juan Pérez García` |
| Usuario | `jperez-2asir@pve` | Contraseña aleatoria y rol `Alumno` sobre su pool |

- **Crear** (`/proxmox/crear/`): desde un TXT `Apellidos, Nombre` o de uno en uno (también vale para profesores, sin clase). Al generar el script de una clase se descarga un **resumen .txt** con los usuarios, pools y contraseñas creados. También puedes descargar las credenciales en CSV o imprimir papeletas.
- **Borrar** (`/proxmox/borrar/`): una clase entera (la busca en el servidor), desde el resumen .txt (respeta los usuarios aunque se editaran a mano) o desde la lista original, o un usuario suelto. Para y destruye las VMs/CTs del pool.
- **Uso de disco** (`/proxmox/auditoria/`): LVM-thin no permite cuotas, así que la cuota se anota en el pool y este script avisa de quién la supera. Se puede instalar como cron diario.

Todos los scripts admiten `--dry-run` y se pueden repetir sin duplicar nada. El rol `Alumno` debe existir antes: el script solo lo asigna.

## Reutilizarlo en tu centro

1. Haz un fork de [jmpa10/utilidades-prieto](https://github.com/jmpa10/utilidades-prieto).
2. Cambia los datos de [`src/lib/centro.ts`](src/lib/centro.ts) (nombre del centro, departamento, logo, autor y repositorio) y pon tu logo en `public/img/`.
3. Despliégalo como se explica abajo. Los valores de Proxmox (rol, realm, storage, cuota, URL) se ajustan desde la página de Ajustes de la propia web.

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
