#!/bin/sh

# Script de entrypoint para executar Prisma no container
# Executa: generate, migrate e seed

set -e

echo "=========================================="
echo "Iniciando setup do banco de dados..."
echo "=========================================="

if [ -n "$DATABASE_URL" ]; then
  # Extrair o host e a porta de conexão do DATABASE_URL dinamicamente
  # Exemplo: postgresql://dev:dev@postgres:5432/church_saas?schema=public
  DB_HOST_PORT=$(echo "$DATABASE_URL" | sed -e 's|.*@||' -e 's|/.*||' -e 's|?.*||')
  DB_HOST=$(echo "$DB_HOST_PORT" | cut -d: -f1)
  DB_PORT=$(echo "$DB_HOST_PORT" | cut -d: -f2)

  # Se a porta for igual ao host (significa que não há porta na string), define como 5432 por padrão
  if [ "$DB_PORT" = "$DB_HOST" ] || [ -z "$DB_PORT" ]; then
    DB_PORT=5432
  fi

  echo "Aguardando banco de dados em $DB_HOST:$DB_PORT..."
  until nc -z -w 2 "$DB_HOST" "$DB_PORT"; do
    echo "Banco de dados ainda não está pronto. Aguardando..."
    sleep 1
  done
  echo "Banco de dados está pronto!"
else
  echo "Aviso: DATABASE_URL não está definida. Pulando verificação de rede."
fi

# 1. Gerar Prisma Client
echo ""
echo "1. Gerando Prisma Client..."
npx prisma generate

# 2. Executar migrations
echo ""
echo "2. Executando migrations do Prisma..."
npx prisma migrate deploy

# 3. Fazer seed do banco
echo ""
echo "3. Executando seed do banco de dados..."
npx prisma db seed

echo ""
echo "=========================================="
echo "Setup do banco concluído com sucesso!"
echo "=========================================="

# Executar a aplicação
echo ""
echo "Iniciando a aplicação NestJS..."
if [ -f "dist/src/main.js" ]; then
  exec node dist/src/main.js
else
  exec node dist/main.js
fi
