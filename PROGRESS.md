# Progress Log

Append-only session log. Update **after every finalized function** before opening a PR.

---

## How to use this file

- Read this file at the **start of every session** to know where things stand.
- Add a new entry **after every finalized function**, using the template below.
- Fill in the commit SHA and PR URL after pushing.
- Never delete entries. Never rewrite history here.
- If you discover a mistake in a past entry, append a correction entry instead of editing the original.

## Entry template

```markdown
## [YYYY-MM-DD HH:MM] <Feature / Function Name>

**Phase:** <Phase 1–6 from CLAUDE.md>
**Scope:** <one-line description>
**Files touched:** <list>
**Tests:** <added / updated / N-A>
**Migration:** <yes/no — name if yes>
**Notes:** <gotchas, follow-ups, decisions made>
**Commit:** <sha>
**PR:** <url>
```

## Session-start commands

Before doing anything else in a working session:

```bash
# In WSL2, from the repo root
pnpm dev:up
# verify
curl http://localhost:4000/api/v1/health
curl http://localhost:3000
```

End of session:

```bash
pnpm dev:down
```

---

## Log

<!-- New entries get appended below this line, newest at the bottom. -->

## [TBD] Project bootstrap

**Phase:** Pre-Phase-1
**Scope:** Initial monorepo scaffold — empty.
**Files touched:** CLAUDE.md, PROGRESS.md, PRICING.md, PERMISSIONS.md, SCHEMA.md
**Tests:** N/A
**Migration:** N/A
**Notes:** Specs written; code not yet started.
**Commit:** —
**PR:** —

---

## [2026-05-15] Phase 1 — Monorepo Foundation

**Phase:** Phase 1 — Foundation
**Scope:** Full monorepo scaffold — root infra, shared packages, NestJS backend (all Phase 1 modules), Next.js frontend (login page, dashboard shell, i18n, theming, 20+ route stubs)
**Files touched:** 131 files across apps/, packages/, infra/, root
**Tests:** N/A (scaffold — Vitest + Jest configured, no test files yet)
**Migration:** First migration runs automatically on `pnpm dev:up` via docker-entrypoint.sh → `prisma migrate deploy`

**What was built:**
- **Root:** pnpm workspace, Turborepo, docker-compose (postgres 16, redis 7, mailhog, backend, frontend), .env.example, .gitattributes, infra/postgres/init.sql (pg_trgm + btree_gist)
- **packages/shared-types:** UserDto, BranchDto, SessionDto, Role enum, API pagination types
- **packages/permissions:** ROLE_DEFAULTS for all 6 roles, canDo resolver, buildEffectivePermissions, isInBranchScope — identical logic runs on FE + BE
- **apps/backend:** Full Prisma schema (40+ models from SCHEMA.md), Auth + Users + Branches + Permissions + AuditLog + Health + Styling + Settings + Lookup modules; global AuthGuard, PermissionGuard, AuditInterceptor, TransformInterceptor, HttpExceptionFilter; multi-stage Dockerfile; docker-entrypoint.sh
- **apps/frontend:** Auth.js v5 credentials provider; login page (glass-morphism card, black abstract blurred BG, two-step credentials→2FA); dashboard layout (collapsible dark sidebar + header); 20+ stub pages; full EN+AR i18n (next-intl); CSS-variable theming (light+dark); typed API client; toast system

**Notes:**
- Login page: compact glass card, black abstract background with 10% blur, two-step form (credentials → 2FA code)
- Dark sidebar by default; all colors from CSS vars → driven by /system/styling
- Global permission check on every route — frontend hides nav items, backend enforces on every request
- To start: `cp .env.example .env && pnpm dev:up`
- Default admin after seed: admin@itour.local / Admin@123456
- Next session: implement Staff CRUD page, Branches CRUD page, Permissions management UI, Profile page with real API calls

**Commit:** 8653378
**PR:** https://github.com/mg-gouda/iTourCarRental/pull/new/feat/p1-monorepo-foundation
