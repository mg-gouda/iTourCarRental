# ── Base ──────────────────────────────────────────────────────────────────────
FROM node:20-alpine AS base
RUN npm install -g pnpm@9.15.4 @nestjs/cli@11 @swc/core @swc/cli chokidar
WORKDIR /app

# ── Development ───────────────────────────────────────────────────────────────
FROM base AS development
ENV NODE_ENV=development

# Copy workspace manifest files
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/permissions/package.json ./packages/permissions/

# Install all deps (including devDependencies)
RUN pnpm install --frozen-lockfile || pnpm install

# Copy source
COPY packages/ ./packages/
COPY apps/backend/ ./apps/backend/

# Build workspace packages so their dist/ is available at runtime
RUN cd packages/shared-types && npx tsc && cd ../../packages/permissions && npx tsc

# Generate Prisma client
RUN cd apps/backend && pnpm prisma generate

WORKDIR /app/apps/backend

EXPOSE 4000

# entrypoint runs migrations + seed + starts the server
CMD ["sh", "docker-entrypoint.sh"]

# ── Builder ───────────────────────────────────────────────────────────────────
FROM base AS builder
ENV NODE_ENV=production

COPY package.json pnpm-workspace.yaml pnpm-lock.yaml* ./
COPY apps/backend/package.json ./apps/backend/
COPY packages/shared-types/package.json ./packages/shared-types/
COPY packages/permissions/package.json ./packages/permissions/

RUN pnpm install --frozen-lockfile --prod || pnpm install --prod

COPY packages/ ./packages/
COPY apps/backend/ ./apps/backend/

# Build workspace packages first
RUN cd packages/shared-types && npx tsc && cd ../../packages/permissions && npx tsc

RUN cd apps/backend && pnpm prisma generate && pnpm build

# ── Production ────────────────────────────────────────────────────────────────
FROM node:20-alpine AS production
RUN npm install -g pnpm@9.15.4
WORKDIR /app
ENV NODE_ENV=production

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/backend/dist ./dist
COPY --from=builder /app/apps/backend/prisma ./prisma
COPY --from=builder /app/apps/backend/node_modules/.prisma ./node_modules/.prisma
COPY apps/backend/docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x docker-entrypoint.sh

EXPOSE 4000

CMD ["sh", "docker-entrypoint.sh"]
