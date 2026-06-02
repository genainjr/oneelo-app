# Build stage
FROM node:20-alpine AS builder

RUN apk add --no-cache openssl python3 make g++

WORKDIR /app

# Copia package.json e lock file
COPY package*.json ./

# Copia diretórios das apps
COPY apps ./apps

# Instala dependências (workspace)
RUN npm install --legacy-peer-deps

# Build da API
WORKDIR /app/apps/api

# Gera Prisma Client
RUN npx prisma generate

# Build da aplicação
RUN npm run build

# Production stage
FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# Copia package.json e lock file
COPY package*.json ./
COPY apps/api/package*.json ./apps/api/

# Instala apenas dependências de produção
RUN npm install --legacy-peer-deps --production && \
    npm install -g @nestjs/cli

# Copia Prisma schema
COPY apps/api/prisma ./apps/api/prisma

# Copia o build da API
COPY --from=builder /app/apps/api/dist ./apps/api/dist

# Copia o Prisma Client gerado
COPY --from=builder /app/apps/api/node_modules/.prisma ./apps/api/node_modules/.prisma

WORKDIR /app/apps/api

EXPOSE 3000

CMD ["node", "dist/main.js"]
