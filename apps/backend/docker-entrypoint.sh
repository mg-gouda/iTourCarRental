#!/bin/sh
set -e

echo "▶ Syncing database schema…"
if [ "$NODE_ENV" = "production" ]; then
  npx prisma migrate deploy
else
  npx prisma db push --accept-data-loss || true
fi

echo "▶ Running database seed…"
# ts-node is in devDependencies; run via pnpm script to pick up local node_modules
pnpm run db:seed || echo "⚠  Seed returned non-zero (non-fatal — check output above)"

echo "▶ Starting NestJS dev server…"
exec nest start --watch
