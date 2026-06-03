#!/bin/sh

# Script de entrypoint para o container no Render/produção
# As migrations são executadas via "Release Command" no Render
# O seed é executado apenas se a variável RUN_SEED estiver definida

set -e

echo "=========================================="
echo "Iniciando a aplicação NestJS..."
echo "=========================================="

# Executar seed opcionalmente (defina RUN_SEED=true nas env vars do Render para rodar)
if [ "$RUN_SEED" = "true" ]; then
  echo ""
  echo "Executando seed do banco de dados..."
  npx prisma db seed
  echo "Seed concluído!"
fi

echo ""

# Detecta onde está o arquivo compilado (dist/main.js ou dist/src/main.js)
if [ -f "dist/src/main.js" ]; then
  exec node dist/src/main.js
else
  exec node dist/main.js
fi
