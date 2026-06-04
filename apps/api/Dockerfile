# Stage 1: Dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Copia apenas package*.json
COPY package*.json ./

# Instala todas as dependências (necessário para build e Prisma)
RUN npm install

# Stage 2: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Instala dependências necessárias do sistema
RUN apk add --no-cache openssl libc6-compat

# Copia node_modules preparado do stage anterior
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

# Copia o código fonte
COPY . .

# Gera o Prisma Client
RUN npx prisma generate

# Compila a aplicação NestJS
RUN npm run build

# Compila o seed do Prisma para execução em produção
RUN npx tsc prisma/seed.ts --outDir dist/prisma --module commonjs --target es2021 --esModuleInterop

# Stage 3: Runtime
FROM node:20-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

# Instala dependências essenciais do sistema
RUN apk add --no-cache openssl netcat-openbsd libc6-compat

# Copia package*.json
COPY package*.json ./

# Instala apenas dependências de produção
RUN npm install --production

# Copia o Prisma schema e migrations
COPY prisma ./prisma

# Gera o Prisma Client para produção
RUN npx prisma generate

# Copia os arquivos compilados do builder
COPY --from=builder /app/dist ./dist

# Copia entrypoint script
COPY entrypoint.sh ./entrypoint.sh
RUN chmod +x ./entrypoint.sh

EXPOSE 3000

ENTRYPOINT ["./entrypoint.sh"]
