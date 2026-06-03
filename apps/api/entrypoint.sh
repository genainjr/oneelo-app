#!/bin/sh

set -e

echo "=========================================="
echo "Iniciando setup do banco de dados..."
echo "=========================================="

# 1. Executar migrations
echo ""
echo "1. Executando migrations do Prisma..."
npx prisma migrate deploy

# 2. Executar seed (opcional - defina RUN_SEED=true nas env vars para rodar)
if [ "$RUN_SEED" = "true" ]; then
  echo ""
  echo "2. Executando seed do banco de dados..."
  npx prisma db seed
  echo "Seed concluído!"
fi

echo ""
echo "=========================================="
echo "Setup do banco concluído com sucesso!"
echo "=========================================="

echo ""

# Detecta onde está o arquivo compilado (dist/main.js ou dist/src/main.js)
if [ -f "dist/src/main.js" ]; then
  exec node dist/src/main.js
else
  exec node dist/main.js
fi
