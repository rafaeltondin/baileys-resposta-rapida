# Use uma versão específica do Node.js
FROM node:18

# Defina o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copie o arquivo package.json e package-lock.json para o diretório de trabalho
COPY package*.json ./

# Instale as dependências do projeto
RUN npm install

# Copie o restante dos arquivos do projeto para o diretório de trabalho
COPY . .

# Exponha a porta em que o aplicativo será executado
EXPOSE 3000

# Defina o comando para iniciar o aplicativo
CMD ["npm", "start"]
