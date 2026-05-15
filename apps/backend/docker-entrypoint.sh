#!/bin/sh
set -e

echo "▶ Syncing database schema…"
if [ "$NODE_ENV" = "production" ]; then
  npx prisma migrate deploy
else
  npx prisma db push --accept-data-loss 2>/dev/null || true
fi

echo "▶ Running database seed…"
npx tsx ./prisma/seed.ts 2>/dev/null || true

echo "▶ Starting NestJS dev server…"
# Use local node_modules/.bin/nest (pnpm installs cli in package-level node_modules)
exec nest start --watch
