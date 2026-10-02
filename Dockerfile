# ── Compilación ──────────────────────────────────────────────
FROM node:22-alpine AS build
WORKDIR /app
# bash y python3: las pruebas ejecutan los scripts generados contra un Proxmox simulado.
RUN apk add --no-cache bash python3
COPY package.json package-lock.json ./
RUN npm ci
COPY . .
RUN npm test && npm run build

# ── Servidor ─────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
HEALTHCHECK CMD wget -qO- http://127.0.0.1/ >/dev/null || exit 1
