# --- Etapa 1: Construcción (Build) ---
# Usamos una imagen de Node para construir el proyecto

FROM node:20-alpine AS build

WORKDIR /app

# Copiamos los archivos de configuración de dependencias
COPY package*.json ./

# Instalamos todas las dependencias (incluyendo devDependencies)
RUN npm install

# Copiamos todo el código fuente
COPY . .

# Construimos la aplicación para producción
RUN npx ng build frontend --configuration=production

# --- Etapa 2: Despliegue (Serve) ---
# Usamos una imagen de Nginx ligera
FROM nginx:1.25-alpine

# Copiamos los archivos estáticos construidos de la etapa anterior
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

# El archivo nginx.conf (que crearemos después) se montará
# en /etc/nginx/conf.d/default.conf, así que no necesitamos copiarlo aquí.

EXPOSE 80