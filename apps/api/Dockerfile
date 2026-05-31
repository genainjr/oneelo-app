FROM node:20-alpine

# Instala dependências do Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copia arquivos de dependência
COPY package*.json ./

RUN npm install

# Copia o restante do código
COPY . .

# Gera o Prisma Client
RUN npx prisma generate

EXPOSE 3000

CMD ["npm", "run", "start:dev"]
