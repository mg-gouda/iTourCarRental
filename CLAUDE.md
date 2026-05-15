# Car Rental

## Project Overview

Car Rental is an internal admin dashboard for managing a car rental business: fleet, bookings, customers, payments, branches, staff, maintenance, and operations.

**Scope for v1:** Admin dashboard only. A customer-facing portal is planned for a later phase — the data model and API must be designed so a customer frontend can be added later without rework.

The project lives in **a single monorepo** at `https://github.com/mg-gouda/iTourCarRental` with two clearly separated apps under `apps/`:

- **`apps/frontend`** — Next.js admin dashboard
- **`apps/backend`** — NestJS API + PostgreSQL

The frontend never talks to the database directly. All data access flows through the backend API. The monorepo lets us run the full stack (frontend + backend + Postgres + Redis + mailhog) with a single `docker compose up`.

### Companion Documents

Deep-dive specs live alongside this file:

- **`PROGRESS.md`** — Append-only session log. Updated after every finalized function.
- **`PRICING.md`** — Pricing engine: rate plans, fee resolution, snapshot rules, worked examples.
- **`PERMISSIONS.md`** — Permissions model: roles, overrides, resolution algorithm, page/action/field matrix.
- **`SCHEMA.md`** — Prisma data schema for the full domain model.

When working on pricing, permissions, or schema, read the matching deep-dive file first — those are the source of truth. When starting a session, read `PROGRESS.md` to pick up where you left off.

---

## Tech Stack

### Frontend (`apps/frontend`)
- **Framework:** Next.js (latest, App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS, themed via CSS variables driven by the Styling system parameters
- **UI components:** shadcn/ui
- **Forms & validation:** React Hook Form + Zod
- **Data fetching:** TanStack Query (React Query)
- **Auth:** Auth.js (NextAuth v5) — credentials provider, session backed by the API
- **i18n:** `next-intl` — English + Arabic, full RTL support
- **State:** Server Components by default; Zustand for client-side state when needed
- **Command palette:** `cmdk` (shadcn pattern)
- **Searchable combo boxes:** shadcn `Combobox` (Radix Popover + `cmdk`) — see Tech Rules below
- **Charts:** Recharts (kept restrained, see Design Rules below)
- **Testing:** Vitest + React Testing Library; Playwright for E2E

### Backend (`apps/backend`)
- **Framework:** NestJS (latest)
- **Language:** TypeScript
- **ORM:** Prisma
- **Database:** PostgreSQL
- **Auth:** Session-based (HTTP-only cookies); passwords hashed with `argon2`; TOTP-based 2FA
- **Validation:** `class-validator` + `class-transformer` for DTOs
- **File storage:** S3-compatible
- **Email:** Nodemailer + SMTP provider
- **PDF generation:** Puppeteer or pdfkit (decide during build)
- **Background jobs:** BullMQ + Redis
- **Observability:** Structured logging (pino), Sentry, `/health` endpoint
- **API versioning:** `/api/v1/...` from day one
- **Testing:** Jest + Supertest

### Shared
- **Package manager:** pnpm
- **Node:** 20 LTS
- **API contract:** REST + JSON
- **CORS:** Backend whitelists the frontend origin

---

## Tech Rules (project-wide)

These are non-negotiable conventions that apply across every feature.

### 1. All dropdowns are searchable combo boxes
- **Never use a plain `<select>` or non-searchable Radix `Select` for any list of options.**
- The default control for choosing from a list — short or long — is the shadcn **`Combobox`** (Radix Popover + `cmdk`).
- Behavior:
  - Type-to-filter on every list, even short ones (consistency matters more than fewer keystrokes).
  - Keyboard-first: arrow keys, Enter to select, Esc to dismiss.
  - Empty state: "No results" message when the filter excludes everything.
  - Async loading for large lists (cars, customers, license plates) — debounced server-side search via the API, paginated, with a loading skeleton in the dropdown.
  - Multi-select variants use the same combo box with checkable items, not a different control.
  - Creatable variants (e.g., tags) allow "Create new" inline when nothing matches.
- A reusable `<Combobox>` and `<AsyncCombobox>` component lives in `components/ui/` and is used everywhere.

### 2. UI/UX follows current design trends
- The design is intentionally **modern, restrained, and information-dense in a calm way** — not generic admin-template aesthetic.
- When designing or substantially redesigning a screen, search the web for current dashboard/admin UI trends and apply what's relevant. Don't lean on the model's training data alone for design choices that age fast.
- Apply these current (2026) principles consistently:
  - **Progressive disclosure** — show the 3–5 most important metrics first; collapse, tab, or drill into the rest.
  - **Restrained color palette** — semantic colors only (success / warning / danger / info / neutral) plus one brand accent. No rainbow palettes.
  - **Consistent color meaning** across charts — if blue = "this period" in one chart, it means the same everywhere.
  - **No chart anti-patterns** — no 3D effects, no dual-axis charts, no pie charts with more than 4 segments.
  - **KPI cards** for headline numbers; bar/line/scatter for the questions they actually answer; tables when users need to look up individual records.
  - **Whitespace is a feature**, not wasted space.
  - **Adaptive surfacing** — different roles see different summaries on the dashboard (the Mechanic's "dashboard" is not the Accountant's).
  - **Mobile-first responsiveness** — the dashboard must be usable on a tablet at a branch counter.
  - **Dark mode is a first-class peer**, not an afterthought; check contrast in both modes.
  - **Animations are functional, not decorative** — micro-interactions for feedback (saved, deleted, dragged), no flourish for its own sake.
- shadcn/ui is the base layer, but components should be styled and composed to feel like *this* product, not stock shadcn. Use the design tokens from the Styling system parameters, not hardcoded values.

### 3. No hardcoded design values
- Colors, fonts, spacing, radii, shadows are all consumed from CSS variables driven by the Styling page.
- Tailwind config reads from those CSS variables.
- Charts pull colors from the same tokens so themes propagate everywhere.

### 4. Accessibility is a baseline, not a feature
- Keyboard navigation everywhere (including combo boxes — already covered by the chosen primitives).
- Visible focus rings in both themes.
- Color contrast WCAG AA minimum in both light and dark modes.
- Forms have labels, accessible error messages, and announce errors to assistive tech.
- All interactive components carry correct ARIA roles and labels.

---

## Operations Rules (workflow-level)

These rules govern *how* development happens, not what's built. They're non-negotiable.

### 1. Docker runs without Docker Desktop

The dev environment runs under **Docker Engine inside WSL2** on Windows — no Docker Desktop required.

**One-time host setup (documented in `infra/SETUP-WSL2.md`):**
1. Install WSL2 + Ubuntu (`wsl --install -d Ubuntu`).
2. Inside the WSL2 distro, install Docker Engine + the Compose plugin from Docker's official `apt` repository.
3. Enable the Docker service: `sudo systemctl enable --now docker`.
4. Add the user to the `docker` group: `sudo usermod -aG docker $USER` (then re-login).
5. Verify: `docker run --rm hello-world`.

**Project requirements:**
- All services (postgres, redis, backend, frontend, mailhog) defined in **one root `docker-compose.yml`**.
- A `Dockerfile` in `apps/frontend/` and `apps/backend/`, each with multi-stage builds (dev target + prod target).
- Volume mounts for source code in dev so hot-reload works inside the containers.
- Named volumes for Postgres and Redis data so DB state survives restarts.
- A separate `docker-compose.prod.yml` overlay for production builds.
- No host dependencies other than Docker Engine + pnpm (pnpm is optional — everything runs in containers).
- The compose file is the source of truth for service ports, env vars, and dependencies.

### 2. Session-start commands

At the start of every working session, run the dev + DB stack before doing anything else. These are documented at the top of `PROGRESS.md` and in the root `README.md`:

```bash
# Inside WSL2, from the repo root
docker compose up -d postgres redis mailhog   # data + mail services in background
docker compose up backend frontend            # dev servers in the foreground with logs
```

Or the shortcut (defined in root `package.json` as `pnpm dev:up`):

```bash
pnpm dev:up
```

What this brings up:
- **Postgres** on `:5432` (named volume `pg_data`)
- **Redis** on `:6379` (named volume `redis_data`)
- **Mailhog** on `:8025` (web UI) and `:1025` (SMTP)
- **Backend** (NestJS) on `:4000` with hot reload
- **Frontend** (Next.js) on `:3000` with hot reload

Migration + seed run automatically on first start via a `backend` entrypoint that executes `prisma migrate deploy && prisma db seed` before `nest start --watch`.

**Health check before starting work:**
```bash
docker compose ps               # all services 'healthy' / 'running'
curl http://localhost:4000/api/v1/health
curl http://localhost:3000
```

**To shut down at end of session:**
```bash
pnpm dev:down                   # docker compose down (data preserved in volumes)
```

### 3. Progress logging in `PROGRESS.md`

After **every finalized function**, append an entry to `PROGRESS.md` at the repo root. "Finalized" means: code written, tested, passing locally, ready to commit.

**Format:**

```markdown
## [YYYY-MM-DD HH:MM] <Feature / Function Name>

**Phase:** <Phase 1–6 from CLAUDE.md>
**Scope:** <one-line description>
**Files touched:** <list>
**Tests:** <added / updated / N-A>
**Migration:** <yes/no — name if yes>
**Notes:** <anything future-you needs to know — gotchas, follow-ups, decisions made>
**Commit:** <commit SHA, filled in after push>
**PR:** <PR URL, filled in after open>
```

`PROGRESS.md` is committed alongside the feature. It is the **session log** — a future Claude (or human) reading it should be able to reconstruct what's been built and what's next without spelunking through Git history.

### 4. Git workflow: feature branch → PR → main

Every finalized function gets its own branch, commit, push, and PR. `main` is protected and never receives direct commits.

**Branch naming:**
- `feat/<phase>-<short-name>` for new features (e.g., `feat/p1-auth-login`)
- `fix/<short-name>` for bug fixes
- `chore/<short-name>` for tooling, docs, CI
- `refactor/<short-name>` for non-behavioral code changes

**Commit messages: Conventional Commits**
- `feat(auth): add login endpoint with 2FA challenge`
- `fix(bookings): prevent overlap on hold + confirmed state`
- `chore(docker): add mailhog service to compose`
- `docs(progress): log P1 auth completion`

**Per-function workflow:**
```bash
git checkout main && git pull
git checkout -b feat/p1-auth-login

# ... do the work ...
# ... update PROGRESS.md ...

git add -A
git commit -m "feat(auth): add login endpoint with 2FA challenge"
git push -u origin feat/p1-auth-login
gh pr create --base main --title "feat(auth): login endpoint" --body "..."
```

**PR description must include:**
- What the change does (one paragraph)
- Phase + scope (matches `PROGRESS.md`)
- Migration impact (if any)
- Test evidence (commands run, output, screenshots for UI work)
- Linked `PROGRESS.md` entry

**Merge rules:**
- Squash-merge to `main` (clean linear history).
- Delete branch on merge.
- `main` must always be deployable — if a PR breaks `main`, revert first, fix later.

### 5. The "after each function" checklist

When a function is done, this checklist runs *in order* before moving on:

1. ✅ Tests pass locally (`pnpm test`, `pnpm test:e2e` if applicable).
2. ✅ Lint + type-check pass (`pnpm lint && pnpm typecheck`).
3. ✅ Manual sanity check via the running dev stack.
4. ✅ `PROGRESS.md` updated with the entry.
5. ✅ Branch + commit using Conventional Commit message.
6. ✅ Push to GitHub.
7. ✅ PR opened against `main` with the required description.
8. ✅ `PROGRESS.md` entry updated with commit SHA + PR URL.

Nothing is "done" until the PR is open.

---

## Architecture

### Repository Layout

Single monorepo at `https://github.com/mg-gouda/iTourCarRental`:

```
iTourCarRental/
├── apps/
│   ├── frontend/          # Next.js admin dashboard
│   └── backend/           # NestJS API
├── packages/              # Shared code (types, permission resolver, utilities)
│   ├── shared-types/
│   └── permissions/
├── infra/
│   ├── postgres/          # init scripts, seed migrations
│   └── nginx/             # reverse proxy config (optional)
├── docker-compose.yml     # Full stack: frontend, backend, postgres, redis, mailhog
├── docker-compose.prod.yml
├── .env.example
├── pnpm-workspace.yaml
├── package.json           # Workspace root
├── turbo.json             # Turborepo for task orchestration
├── CLAUDE.md
├── PROGRESS.md
├── PRICING.md
├── PERMISSIONS.md
└── SCHEMA.md
```

The two apps stay clearly separated (separate `package.json`, separate `Dockerfile`, separate deploy targets) — they're just in the same Git repo.

### Authentication Flow

1. Unauthenticated requests to protected routes redirect to `/login`.
2. Credentials POSTed to the backend; session issued.
3. Session lives in an HTTP-only, `Secure`, `SameSite=Lax` cookie.
4. Frontend middleware guards protected routes; backend re-validates every request.
5. RBAC + per-user permission overrides enforced server-side on every endpoint.
6. 2FA required for Super Admin and Accountant; optional for others.
7. Logout clears the session and returns the user to `/login`.

See `PERMISSIONS.md` for the full model.

---

## Domain Model (summary)

The full domain model — every entity, every field, relationships, indexes, and constraints — lives in **`SCHEMA.md`**. This is the summary.

### Roles
Super Admin, Branch Manager, Staff/Agent, Accountant, Mechanic, Customer (data-model only in v1).

### Core Entities
Branch, Car, Customer, Additional Driver, Corporate Account, Booking, Booking Modification, Vehicle Inspection, Payment, Refund, Invoice, Credit Note, Damage & Fines, Insurance Policy, Accident Report, Maintenance Record, Maintenance Vendor, Parts Inventory, Audit Log, Notification, Webhook, API Key, Feature Flag, Rate Plan, Cancellation Policy, SLA Target, Saved Search, Tag.

### Hard Invariants
- **No double-booking** — exclusion constraint at the DB level + service-layer enforcement.
- **Snapshots are permanent** — bookings, invoices, refunds capture full pricing/license/tax state at the moment of action and never recompute from live data.
- **Soft delete for financial records** — cars, customers, bookings, invoices use `deleted_at`; hard delete is reserved and audit-logged.

---

## System Parameters

A dedicated section grouping system-wide settings. Access is permission-gated.

### Pages

**1. Permissions (`/system/permissions`)** — see `PERMISSIONS.md`
- Configure role defaults across pages, actions, and fields.
- Manage per-user overrides.
- View effective permission matrix per user.
- Every change is audit-logged.

**2. Styling & Branding (`/system/styling`)**
- Logo (primary, alternate, favicon)
- Theme colors (primary, accent, semantic)
- Typography (Latin + Arabic font families, scale)
- Light + dark mode variants
- Border radius, spacing scale, shadow intensity
- Changes propagate via CSS variables; live preview before save.

**3. User Profile (`/profile`)**
- View / edit own info
- Change password (policy-enforced)
- Avatar upload
- Language preference (EN / AR)
- Theme override (light / dark / system)
- Notification preferences
- 2FA setup (TOTP)
- Active sessions; force logout per session
- Personal activity log

**4. General Settings (`/system/settings`)**
- Password policy, login throttling, account lockout
- Cancellation policy defaults
- SLA targets
- Tax defaults
- Feature flags
- Webhook endpoints
- API keys

---

## Cross-Cutting Concerns

### Internationalization
- Bilingual EN + AR with full RTL.
- All UI strings in translation files.
- Dates, numbers, currency formatted per locale.
- PDFs rendered in the user's language.

### Multi-Currency
- Branch default currency.
- Bookings/invoices snapshot the transacted currency.
- FX rates stored (not live-fetched in v1).

### Time Zones
- All datetimes stored in UTC; rendered in branch-local time.
- Time zone shown wherever a datetime is displayed.

### Audit Trail
- NestJS interceptor logs every mutating action automatically.
- Visible to Super Admin under `/audit-log`.

### File Uploads
- S3-compatible storage; signed expiring URLs.
- MIME type and size validated server-side.

### Reporting / Analytics
- Revenue (by day, month, branch, car, rate plan)
- Fleet utilization
- Booking stats (status breakdown, no-shows)
- Maintenance costs vs. revenue per car
- Top customers
- Staff activity
- SLA compliance
- All reports respect role scope and per-user permissions.

### Notifications
- Email + in-app, BullMQ-driven, per-user preferences.

### Soft Deletes
- All entities with financial implications use `deleted_at`.

### Idempotency
- Mutating endpoints accept `Idempotency-Key` — required for bookings, payments, refunds.

### Rate Limiting
- Global limits with stricter auth-endpoint thresholds.

### Data Retention & Privacy
- Documented retention policy.
- Export + delete endpoints per customer (GDPR-style).
- PII anonymization preserves financial records.

### Backup & DR
- Documented backup cadence for Postgres + S3.
- Restore tested annually.

### Two-Person Rule
- Refunds above a configurable threshold require second-user approval.

### Telematics-Ready
- Nullable GPS/odometer fields and webhook infrastructure in place for future integration.

---

## Routing

### Frontend (admin dashboard)

| Route                          | Auth | Description                          |
|--------------------------------|------|--------------------------------------|
| `/login`                       | No   | Login                                |
| `/dashboard`                   | Yes  | Role-adaptive overview               |
| `/calendar`                    | Yes  | Booking calendar / Gantt             |
| `/cars`                        | Yes  | Fleet                                |
| `/bookings`                    | Yes  | Bookings + holds + waitlist          |
| `/customers`                   | Yes  | Customers                            |
| `/corporate-accounts`          | Yes  | Corporate accounts                   |
| `/payments`                    | Yes  | Payments + deposits                  |
| `/invoices`                    | Yes  | Invoices + credit notes              |
| `/damage-fines`                | Yes  | Damage + fines                       |
| `/maintenance`                 | Yes  | Maintenance + scheduling             |
| `/maintenance/vendors`         | Yes  | External workshops                   |
| `/parts`                       | Yes  | Parts inventory                      |
| `/accidents`                   | Yes  | Accident reports                     |
| `/insurance`                   | Yes  | Per-car policies                     |
| `/branches`                    | Yes  | Branches                             |
| `/staff`                       | Yes  | Staff / users                        |
| `/reports`                     | Yes  | Analytics                            |
| `/audit-log`                   | Yes  | Audit trail                          |
| `/system/permissions`          | Yes  | Permissions                          |
| `/system/styling`              | Yes  | Theme + branding                     |
| `/system/settings`             | Yes  | General settings                     |
| `/profile`                     | Yes  | User profile                         |
| `/help`                        | Yes  | In-app docs                          |

### Backend API
All routes under `/api/v1/...`. Representative subset:

| Route                                  | Method  | Description                  |
|----------------------------------------|---------|------------------------------|
| `/api/v1/auth/*`                       | various | Login, logout, session, 2FA  |
| `/api/v1/cars` + `/:id` + `/transfer`  | various | Fleet                        |
| `/api/v1/bookings` + `/:id/*`          | various | Bookings, holds, modifications, inspections |
| `/api/v1/customers`                    | various | Customers                    |
| `/api/v1/corporate-accounts`           | various | Corporate accounts           |
| `/api/v1/payments` / `/refunds`        | various | Money                        |
| `/api/v1/invoices/:id/pdf`             | GET     | Invoice PDF                  |
| `/api/v1/maintenance` + vendors + parts| various | Maintenance                  |
| `/api/v1/branches` / `users`           | various | Org                          |
| `/api/v1/permissions` / `styling` / `settings` | various | System parameters     |
| `/api/v1/reports/*`                    | GET     | Analytics                    |
| `/api/v1/audit-log`                    | GET     | Audit                        |
| `/api/v1/notifications`                | various | Notifications                |
| `/api/v1/webhooks` / `api-keys` / `feature-flags` | various | Platform           |
| `/api/v1/lookup/*`                     | GET     | Combo-box async search endpoints (cars, customers, etc.) |
| `/api/v1/health`                       | GET     | Health                       |

Note the dedicated `/lookup/*` endpoints — these power the searchable combo boxes (Tech Rule 1) with paginated, debounced server-side search.

---

## Project Structure

### `apps/frontend/`
```
src/
├── app/
│   ├── (auth)/login/
│   ├── (dashboard)/
│   │   ├── dashboard/ calendar/ cars/ bookings/ customers/
│   │   ├── corporate-accounts/ payments/ invoices/ damage-fines/
│   │   ├── maintenance/ parts/ accidents/ insurance/
│   │   ├── branches/ staff/ reports/ audit-log/
│   │   ├── system/ (permissions, styling, settings)
│   │   ├── profile/ help/
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/            # shadcn/ui + Combobox, AsyncCombobox
│   └── shared/
├── features/          # Feature-grouped logic
├── lib/
│   ├── api.ts         # Typed API client
│   ├── auth.ts        # Auth.js config
│   ├── permissions.ts # Mirrors @car-rental/permissions
│   ├── theme.ts       # CSS-variable theme loader
│   └── utils.ts
├── i18n/              # next-intl messages (en, ar)
├── middleware.ts
└── types/
Dockerfile             # multi-stage: dev + prod
```

### `apps/backend/`
```
src/
├── modules/
│   ├── auth/ users/ permissions/ branches/ cars/ customers/
│   ├── corporate-accounts/ bookings/ inspections/ payments/
│   ├── refunds/ invoices/ damage-fines/ maintenance/ vendors/
│   ├── parts/ accidents/ insurance/ reports/ notifications/
│   ├── webhooks/ api-keys/ feature-flags/ styling/ settings/
│   ├── lookup/        # Combo-box search endpoints
│   └── audit-log/
├── common/
│   ├── guards/ decorators/ interceptors/ filters/ pipes/
├── jobs/              # BullMQ processors
├── config/
├── main.ts
└── app.module.ts
prisma/
├── schema.prisma      # See SCHEMA.md
├── migrations/
└── seed.ts
Dockerfile             # multi-stage: dev + prod
docker-entrypoint.sh   # runs migrate + seed before starting
```

### `packages/`
Shared code across both apps, published as internal workspace packages.

- `packages/shared-types/` — generated TypeScript types from Prisma + DTO shapes.
- `packages/permissions/` — the permission resolver (`canDo`, `canDoOn`), imported by both frontend and backend so they cannot drift.

### Root files
- `docker-compose.yml` — dev stack (postgres, redis, mailhog, backend, frontend)
- `docker-compose.prod.yml` — production overrides
- `pnpm-workspace.yaml` — workspace definition
- `turbo.json` — Turborepo task graph (`build`, `lint`, `test`, `dev`)
- `package.json` — root scripts: `dev:up`, `dev:down`, `lint`, `test`, `typecheck`
- `CLAUDE.md` / `PROGRESS.md` / `PRICING.md` / `PERMISSIONS.md` / `SCHEMA.md`

---

## Development Conventions

### General
- TypeScript everywhere. No `any` without justification.
- Validate every external input.
- Server Components by default; `"use client"` only when needed.
- Business logic on backend; frontend orchestrates UI and calls API.

### Auth & Authorization
- HTTP-only cookies for sessions. Never `localStorage`.
- argon2 password hashing.
- 2FA mandatory for Super Admin and Accountant.
- Backend re-checks session + permissions on **every** request.
- Branch-scoped roles must verify branch ownership on every query.

### API
- REST under `/api/v1/...`.
- Errors: `{ error: { code, message, details? } }`.
- Correct HTTP status codes (401 vs 403, 400 vs 422, 409 conflicts).
- Pagination by default on list endpoints.
- `Idempotency-Key` on mutating endpoints.

### Database
- Prisma migrations only — no manual SQL.
- Migrations are committed; never edit one applied to a shared environment.
- Transactions for multi-step writes.
- DB-level constraints for invariants (booking overlap, unique invoice number per branch).
- Soft deletes on financial entities.
- Seed script for dev environment.

### Pricing & Snapshots
- Snapshot full price breakdown onto bookings, invoices, refunds.
- Never recompute historical financials from current rates.
- See `PRICING.md`.

### File Uploads
- Server-side MIME + size validation.
- Signed, expiring read URLs.

### i18n & RTL
- No hardcoded strings.
- Both LTR and RTL tested.
- Arabic is first-class.

### Styling
- All design tokens flow from CSS variables (driven by `/system/styling`).
- No hex codes, no hardcoded font names, no magic-number paddings in components.

### Error & Empty States
- Every list, form, detail page has designed states for: loading, empty, error, success.
- No blank screens.

### Background Jobs
- Long-running work in BullMQ workers.
- Jobs are idempotent and retry with exponential backoff.

### Observability
- Structured logs with request IDs.
- Sentry on both ends.
- `/health` on backend.

### Testing
- Unit tests for pricing engine, permission resolver, booking overlap logic.
- E2E (Playwright) for auth flow and booking happy path.

### Bulk & Power-User Features
- CSV import (cars, customers, historical bookings).
- Bulk operations on list pages where appropriate.
- Command palette (`cmd+k`) across the app.
- Print-friendly views for contracts, invoices, daily handover sheets.

### Saved Views & Filters
- Every list page supports filter + sort + saved-view persistence per user.

---

## Phased Delivery Plan

**Phase 1 — Foundation:** Auth (incl. 2FA), users, roles, permissions, branches, staff, System Parameters scaffolding (permissions, styling, settings), profile, i18n, theming, audit log, health check, observability.

**Phase 2 — Fleet & Customers:** Cars, transfers, insurance policies, customers, corporate accounts, additional drivers, tags, notes, file uploads.

**Phase 3 — Bookings & Pricing:** Rate plans, pricing engine, bookings (holds, modifications, waitlist), calendar view, inspections, signatures, fuel/mileage policies, cancellation policy.

**Phase 4 — Money:** Payments (deposits), refunds, invoices (PDF, EN/AR), credit notes, tax config, two-person rule, damage + fines reconciliation.

**Phase 5 — Maintenance & Operations:** Maintenance records, vendors, parts inventory, accidents, lifecycle tracking, booking blocks during maintenance.

**Phase 6 — Insights & Integrations:** Reports/analytics, SLA tracking, notifications, saved views, bulk operations, CSV import, command palette, webhooks, API keys, feature flags, in-app help.

Each phase is shippable.

---

## Getting Started

### First-time setup

```bash
# 1. Clone (inside WSL2)
git clone https://github.com/mg-gouda/iTourCarRental.git
cd iTourCarRental

# 2. Configure env
cp .env.example .env
# fill in: POSTGRES_PASSWORD, SESSION_SECRET, AUTH_SECRET, SMTP_*, S3_*, SENTRY_DSN

# 3. Bring up the full stack (builds images on first run)
docker compose up -d postgres redis mailhog
docker compose up backend frontend
```

The `backend` service runs `prisma migrate deploy && prisma db seed` automatically before starting, so the database is ready on first boot.

### Every subsequent session

```bash
# In WSL2, from the repo root
pnpm dev:up        # alias for the compose-up sequence above
# ... work ...
pnpm dev:down      # bring everything down, keeping DB volumes
```

### Service URLs (dev)

| Service   | URL                              |
|-----------|----------------------------------|
| Frontend  | http://localhost:3000            |
| Backend   | http://localhost:4000/api/v1     |
| Health    | http://localhost:4000/api/v1/health |
| Mailhog   | http://localhost:8025            |
| Postgres  | localhost:5432 (db: `carrental`) |
| Redis     | localhost:6379                   |

### Running tests inside the containers

```bash
docker compose exec backend pnpm test
docker compose exec frontend pnpm test
docker compose exec frontend pnpm test:e2e
```

---

## Notes for Claude

**Workflow**
- **Start of every session:** run `pnpm dev:up` (or the compose-up sequence) before anything else. Verify health endpoints respond.
- **After every finalized function:** update `PROGRESS.md`, then branch + commit + push + open PR (see Operations Rules).
- **Never commit directly to `main`.** Always feature branch → PR → squash merge.
- **Conventional Commits** for all commit messages.

**Code defaults**
- Default new routes to **gated behind auth + permission-checked**.
- For dropdowns: always reach for `Combobox` / `AsyncCombobox`. Never plain `<select>`.
- For UI: search current design trends before designing or substantially redesigning a screen.
- For backend endpoints: DTO validation, permission guard, audit-logged if mutating, idempotency-aware if it creates financial state, typed client helper on the frontend.
- For frontend pages: Server Component by default, translation keys for all strings, RTL-aware, designed loading/empty/error states, permission-gated UI.
- Don't put DB access, secrets, or business logic in the frontend app.
- Don't put UI concerns in the backend app.

**Invariants**
- Customer-facing UI is out of scope for v1 — design with it in mind anyway.
- The "no double-booking" rule is a hard invariant — enforce in service logic **and** at the DB level.
- Prices, currencies, license info, and tax must be **snapshotted** — never recomputed.
- When in doubt about auth, permissions, pricing, or financial flows, ask first. High blast radius.

**Reading order**
- For pricing details, read `PRICING.md`.
- For permissions, read `PERMISSIONS.md`.
- For schema, read `SCHEMA.md`.
- For session/workflow state, read `PROGRESS.md`.
