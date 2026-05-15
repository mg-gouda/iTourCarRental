# iTour Car Rental

Internal admin dashboard for managing a car rental business.

## Quick start (WSL2 + Docker Engine)

```bash
# 1. Copy env file and fill in secrets
cp .env.example .env

# 2. Start the full stack (first run builds Docker images)
pnpm dev:up

# 3. Open in browser
#    Frontend:  http://localhost:3000
#    Backend:   http://localhost:4000/api/v1/health
#    Mailhog:   http://localhost:8025

# 4. Default admin credentials (from .env SEED_*)
#    Email:    admin@itour.local
#    Password: Admin@123456

# 5. Shut down (data preserved in Docker volumes)
pnpm dev:down
```

## Monorepo structure

```
apps/
  frontend/   Next.js 15 admin dashboard
  backend/    NestJS 11 API + Prisma
packages/
  shared-types/   TypeScript types shared between apps
  permissions/    Permission resolver (runs on both FE + BE)
```

## Tech stack

| Layer | Tech |
|---|---|
| Frontend | Next.js 15 (App Router), Tailwind CSS, shadcn/ui, Auth.js v5 |
| Backend | NestJS 11, Prisma 6, PostgreSQL 16 |
| Auth | HTTP-only session cookies, argon2, TOTP 2FA |
| Infra | Docker Compose (dev), pnpm workspaces, Turborepo |

## See also

- `CLAUDE.md` — full project spec
- `PROGRESS.md` — session log
- `SCHEMA.md` — Prisma data model
- `PERMISSIONS.md` — RBAC model
- `PRICING.md` — pricing engine
- `infra/SETUP-WSL2.md` — one-time WSL2 + Docker setup
