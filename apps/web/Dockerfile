# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copia arquivos de dependência
COPY package*.json ./

# Instala todas as dependências
RUN npm install

# Copia o código fonte
COPY . .

# Recebe NEXT_PUBLIC_API_URL no build time (Next.js precisa disso no build para injetar no client)
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

# Executa build de produção
RUN npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copia arquivos de dependência e instala apenas pacotes de produção
COPY package*.json ./
RUN npm install --production

# Copia os arquivos gerados no build e arquivos estáticos
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.ts ./next.config.ts

# Define a variável no runner também caso seja utilizada em SSR/Server Components
ARG NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL

EXPOSE 3000

CMD ["npm", "run", "start"]
