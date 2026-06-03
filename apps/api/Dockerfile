FROM node:20-alpine

# Instala dependências necessárias para rodar o NestJS, Prisma e verificação do entrypoint
RUN apk add --no-cache openssl netcat-openbsd libc6-compat

WORKDIR /app

# Copia arquivos de dependência
COPY package*.json ./

# Instala todas as dependências (necessário incluir devDependencies para compilação e execução de migrações/seeders no container)
RUN npm install

# Copia o restante do código
COPY . .

# Gera o Prisma Client
RUN npx prisma generate

# Compila a aplicação NestJS
RUN npm run build

# Torna o script de entrypoint executável
RUN chmod +x ./entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
