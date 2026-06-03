#!/bin/sh

set -e

echo "=========================================="
echo "Iniciando a aplicação NestJS..."
echo "=========================================="

# Detecta onde está o arquivo compilado (dist/main.js ou dist/src/main.js)
if [ -f "dist/src/main.js" ]; then
  exec node dist/src/main.js
else
  exec node dist/main.js
fi
