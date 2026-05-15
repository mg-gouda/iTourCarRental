#!/bin/sh
set -e

echo "▶ Running Prisma migrations…"
npx prisma migrate deploy --schema=./apps/backend/prisma/schema.prisma 2>/dev/null || \
  npx prisma migrate deploy --schema=./prisma/schema.prisma 2>/dev/null || true

echo "▶ Running database seed…"
npx ts-node --project ./apps/backend/tsconfig.json ./apps/backend/prisma/seed.ts 2>/dev/null || \
  npx ts-node --project ./tsconfig.json ./prisma/seed.ts 2>/dev/null || true

echo "▶ Starting NestJS server…"
if [ "$NODE_ENV" = "production" ]; then
  node dist/main
else
  cd apps/backend && pnpm start:dev
fi
