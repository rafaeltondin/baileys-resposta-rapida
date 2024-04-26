# Use uma imagem base com Node.js
FROM node:14

# Defina o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copie os arquivos package.json e package-lock.json para o diretório de trabalho
COPY package*.json ./

# Instale apenas as dependências de produção
RUN npm ci --only=production

# Copie o restante dos arquivos do projeto para o diretório de trabalho
COPY . .

# Exponha a porta em que o aplicativo será executado (se necessário)
# EXPOSE 3000

# Comando para iniciar o aplicativo
CMD ["npm", "start"]
