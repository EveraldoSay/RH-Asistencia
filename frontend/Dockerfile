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
# Nota: El output path en angular.json es "dist/frontend", por eso usamos esa ruta.
RUN npx ng build --configuration=production

# --- Etapa 2: Despliegue (Serve) ---
# Usamos una imagen de Nginx ligera
FROM nginx:1.25-alpine

# Copiamos los archivos estáticos construidos de la etapa anterior
# El path es dist/frontend/browser por el builder @angular/build:application
COPY --from=build /app/dist/frontend/browser /usr/share/nginx/html

# Copiamos y preparamos el script de entrypoint
COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

# El archivo nginx.conf se montará como un volumen, por lo que no se copia aquí.

EXPOSE 80

# Usamos el script como entrypoint para reemplazar las variables de entorno
ENTRYPOINT ["/entrypoint.sh"]

# El comando por defecto es iniciar Nginx en primer plano
CMD ["nginx", "-g", "daemon off;"]