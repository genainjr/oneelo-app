#!/bin/sh

set -e

# Migrations devem ser uma operacao explicita do deploy, nunca um efeito do boot.
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running database migrations..."
  npx prisma migrate deploy
else
  echo "Skipping database migrations (RUN_MIGRATIONS is not true)."
fi

if [ "$RUN_SEED" = "true" ]; then
  echo "Running destructive database seed..."
  ./scripts/run-destructive-seed.sh
else
  echo "Skipping database seed (RUN_SEED is not true)."
fi

echo "Starting NestJS application..."
if [ -f "dist/src/main.js" ]; then
  exec node dist/src/main.js
fi

exec node dist/main.js
