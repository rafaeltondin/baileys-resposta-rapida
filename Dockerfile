# Use a imagem base do Node.js com a versão mais recente
FROM node:latest

# Atualize o gerenciador de pacotes e instale dependências do sistema
RUN apt-get update && apt-get install -y ffmpeg

# Defina o diretório de trabalho dentro do contêiner
WORKDIR /app

# Copie o arquivo package.json e package-lock.json para o diretório de trabalho
COPY package*.json ./

# Instale as dependências do projeto
RUN npm install

# Copie o restante dos arquivos do projeto para o diretório de trabalho
COPY . .

# Exponha a porta em que o aplicativo será executado (se necessário)
EXPOSE 3000

# Defina o comando para iniciar o aplicativo
CMD ["npm", "start"]
