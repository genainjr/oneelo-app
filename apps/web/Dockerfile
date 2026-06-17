# Stage 1: Dependencies
FROM node:20-alpine AS deps

WORKDIR /app

# Copia apenas package*.json
COPY package*.json ./

# Instala todas as dependências
RUN npm install

# Stage 2: Builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copia o node_modules preparado
COPY --from=deps /app/node_modules ./node_modules
COPY package*.json ./

# Copia o código fonte
COPY . .

# Recebe NEXT_PUBLIC_API_URL no build time
ARG NEXT_PUBLIC_API_URL=http://localhost:4001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG INTERNAL_API_URL=http://api:4001
ENV INTERNAL_API_URL=$INTERNAL_API_URL

# Executa build de produção
RUN npm run build

# Stage 3: Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copia package*.json
COPY package*.json ./

# Instala apenas pacotes de produção
RUN npm install --production

# Copia os arquivos gerados no build
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

# Define a variável no runner
ARG NEXT_PUBLIC_API_URL=http://localhost:4001
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

ARG INTERNAL_API_URL=http://api:4001
ENV INTERNAL_API_URL=$INTERNAL_API_URL

EXPOSE 3001

CMD ["npm", "run", "start"]
