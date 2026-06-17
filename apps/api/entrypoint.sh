#!/bin/sh

set -e

echo "=========================================="
echo "Iniciando a aplicação NestJS em background..."
echo "=========================================="

# Inicia o servidor em background
if [ -f "dist/src/main.js" ]; then
  node dist/src/main.js &
else
  node dist/main.js &
fi

SERVER_PID=$!

# Aguarda a porta 4001 abrir para garantir que a API está online
echo "Aguardando a porta 4001 responder..."
while ! nc -z localhost 4001; do
  sleep 0.5
done
echo "API está online! Iniciando tarefas de banco..."

# 1. Rodar migrations (cria/atualiza schema do banco)
echo "Running database migrations..."
npx prisma migrate deploy

# 2. Rodar seed (popula dados iniciais, opcional)
if [ "$RUN_SEED" = "true" ]; then
  echo "Running database seed..."
  npx prisma db seed
else
  echo "Skipping database seed (RUN_SEED is not set to true)..."
fi

echo "=========================================="
echo "Setup concluído com sucesso!"
echo "=========================================="

# Mantém o processo do servidor rodando no foreground
wait $SERVER_PID
