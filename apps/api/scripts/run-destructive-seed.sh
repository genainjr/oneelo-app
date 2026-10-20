#!/bin/sh

set -e

if [ "$RUN_SEED" != "true" ]; then
  echo "Refusing seed. Set RUN_SEED=true explicitly." >&2
  exit 1
fi

if [ "$ALLOW_DESTRUCTIVE_SEED" != "local-development" ]; then
  echo "Refusing destructive seed. Set ALLOW_DESTRUCTIVE_SEED=local-development only for a disposable local database." >&2
  exit 1
fi

exec npx prisma db seed
