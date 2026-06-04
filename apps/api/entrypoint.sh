#!/bin/sh

set -e

echo "=========================================="
echo "Iniciando setup da aplicação NestJS..."
echo "=========================================="

# 1. Rodar migrations (cria/atualiza schema do banco)
echo "Running database migrations..."
npx prisma migrate deploy

# 2. Rodar seed (popula dados iniciais)
echo "Running database seed..."
npx prisma db seed

# 3. Iniciar aplicação
echo "=========================================="
echo "Iniciando a aplicação NestJS..."
echo "=========================================="

# Detecta onde está o arquivo compilado (dist/main.js ou dist/src/main.js)
if [ -f "dist/src/main.js" ]; then
  exec node dist/src/main.js
else
  exec node dist/main.js
fi
