# Usa una imagen de Node.js ligera (basada en Alpine Linux)
FROM node:20-alpine

# Establece el directorio de trabajo dentro del contenedor
WORKDIR /usr/src/app

# Copia package.json y package-lock.json
COPY package*.json ./

# Instala solo las dependencias de producción
RUN npm install --production

# Copia el resto del código de tu aplicación
COPY . .

# Expone el puerto en el que corre tu app (ej. 3000)
# Esto es solo documentación, el puerto real se define en tu app.
EXPOSE 3000

# Comando para iniciar tu aplicación
CMD [ "node", "server.js" ]