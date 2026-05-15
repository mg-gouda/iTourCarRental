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
**Commit:** fe5ae66
**PR:** https://github.com/mg-gouda/iTourCarRental/pull/new/feat/p1-phase1-ui

---

## [2026-05-15 12:00] Auth Fix — Direct Browser Login + Credential Reset + Phase 2 Modules

**Phase:** Phase 1 fix + Phase 2 start
**Scope:** Fix auth flow (browser→backend direct fetch); reset admin credentials; add Cars/Customers/Corporate Accounts/Insurance backend modules

**Files touched:**
- `.env.example` — `SEED_ADMIN_EMAIL=mggouda@gmail.com`, `SEED_ADMIN_PASSWORD=Win16@64`
- `apps/backend/prisma/seed.ts` — Reset defaults to mggouda@gmail.com / Win16@64; added stale super-admin cleanup before upsert
- `apps/frontend/src/lib/auth.ts` — Rewrote: Auth.js is now purely a JWT/session store; `authorize()` just parses `_user` JSON — no backend call
- `apps/frontend/src/app/(auth)/login/page.tsx` — Login page calls `POST /api/v1/auth/login` directly from browser with `credentials: 'include'` so browser receives `sid` httpOnly cookie; passes user object to `signIn('credentials', { _user })` for JWT storage
- `apps/backend/src/modules/cars/` — New: CarsModule, CarsService, CarsController (CRUD + list/search), CreateCarDto
- `apps/backend/src/modules/customers/` — New: CustomersModule, CustomersService, CustomersController, CustomerDto
- `apps/backend/src/modules/corporate-accounts/` — New: full CRUD module
- `apps/backend/src/modules/insurance/` — New: InsurancePoliciesModule
- `apps/backend/src/modules/lookup/lookup.controller.ts` — Extended: cars + customers + corporate-accounts lookup endpoints
- `apps/backend/src/app.module.ts` — Wired all new modules
- `apps/frontend/src/lib/api.ts` — Expanded: typed helpers for cars, customers, corporate accounts, insurance
- `apps/frontend/src/app/(dashboard)/cars/page.tsx` + `cars-client.tsx` — Scaffolded cars list with DataTable
- `apps/frontend/src/app/(dashboard)/customers/page.tsx` — Scaffolded customers list

**Tests:** N/A
**Migration:** No new migrations (new modules use existing Prisma schema)

**Notes:**
- The core auth bug: original `auth.ts` called backend server-side — the `sid` cookie went to the Next.js server process, not the browser. Fix: login page calls backend directly from browser.
- Admin credentials: `mggouda@gmail.com` / `Win16@64` — takes effect on next `pnpm dev:up` (seed re-runs on container start)
- To verify login: `pnpm dev:up`, open http://localhost:3000, sign in with `mggouda@gmail.com` / `Win16@64`

**Commit:** 6245271
**PR:** https://github.com/mg-gouda/iTourCarRental/pull/new/feat/p1-phase1-ui

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

---

## [2026-05-15] Phase 1 — UI Implementation (Branches, Staff, Permissions, Profile)

**Phase:** Phase 1 — Foundation
**Scope:** Full implementation of Branches CRUD, Staff CRUD, Permissions management, and Profile pages with live API calls
**Files touched:**
- `apps/frontend/src/components/ui/` — Button, Input, Label, Badge, Card, Dialog, Sheet, Table, Separator, Switch, Tabs, Avatar, DropdownMenu, Toaster (rebuilt), Combobox, AsyncCombobox, DataTable
- `apps/frontend/src/lib/api.ts` — Extended with domain types + typed helpers for branches, users, profile, permissions, lookup
- `apps/frontend/src/lib/hooks/use-debounce.ts` — New hook
- `apps/frontend/src/lib/hooks/use-toast.ts` — New global toast store
- `apps/frontend/src/app/(dashboard)/branches/` — Full CRUD with DataTable + Sheet form + delete dialog
- `apps/frontend/src/app/(dashboard)/staff/` — Full CRUD with role/branch Combobox selectors + avatar initials + reset-password dialog
- `apps/frontend/src/app/(dashboard)/system/permissions/` — Role matrix (toggle grid) + per-user overrides tab with add/remove
- `apps/frontend/src/app/(dashboard)/profile/` — Tabs: Profile info, Change password, 2FA setup/disable, Active sessions with revoke
- `apps/frontend/package.json` — Added `@tanstack/react-table ^8.21.3`; fixed `next-intl` to `^3.26.5`

**Tests:** N/A
**Migration:** No new migrations

**Notes:**
- All dropdowns use Combobox/AsyncCombobox — no plain `<select>` anywhere
- DataTable: server-side pagination + client-side sort/filter; loading skeleton via animated rows
- Permissions page: matrix is read-only for SUPER_ADMIN (always granted), live toggle for all other roles; user overrides tab has an AsyncCombobox user picker
- Profile 2FA: setup flow shows secret + QR placeholder, verify code to enable; disable requires current password
- Sessions tab shows device/IP/last-active with revoke buttons (current session protected)
- Backend fix committed to `feat/p1-monorepo-foundation`: tightened permission guard, auth service, users controller; added `express.d.ts` type declaration

**Commit:** 30887a3
**PR:** https://github.com/mg-gouda/iTourCarRental/pull/new/feat/p1-phase1-ui

---

## [2026-05-15 11:18] Docker Dev Stack — Full Startup Fix

**Phase:** Infrastructure (pre-Phase-2)
**Scope:** Fix all Docker startup blockers so `pnpm dev:up` brings the full stack up clean
**Files touched:**
- `apps/backend/Dockerfile` — Install `@nestjs/cli@11 @swc/core @swc/cli chokidar` globally via npm so NestJS CLI can load SWC from its own module search path; add `npx tsc` steps to compile workspace packages before starting backend
- `apps/backend/.swcrc` — Removed `paths` (NestJS CLI injects paths from tsconfig; having them in .swcrc too caused double-processing)
- `apps/backend/tsconfig.build.json` — Set `"paths": {}` to prevent NestJS CLI from passing TypeScript path aliases to SWC (aliases compiled to broken relative paths at runtime); workspace package resolution now happens via pnpm symlinks → `packages/*/dist/`
- `apps/backend/src/common/guards/auth.guard.ts` — `import type` for express
- `apps/backend/src/common/guards/permission.guard.ts` — `import type` for express
- `apps/backend/src/modules/auth/auth.controller.ts` — `import type` for express
- `apps/backend/src/common/filters/http-exception.filter.ts` — `import type` for express
- `apps/backend/src/common/interceptors/audit.interceptor.ts` — `import type` for express
- `packages/permissions/src/index.ts` — Replaced `require('./role-defaults')` dynamic require with static import (was causing TS2580 in Docker where `@types/node` isn't in the package's own devDeps)
- `packages/shared-types/src/` + `packages/permissions/src/` — Removed stale pre-compiled `.js` / `.js.map` files that had leaked into `src/`

**Tests:** Manual — `curl http://localhost:4000/api/v1/health` returns `{"data":{"status":"ok"}}`; frontend at `:3000` serves login redirect
**Migration:** None

**Notes:**
- Root cause of the SWC resolution failure: pnpm's virtual-store layout doesn't create a `node_modules/@swc/core` symlink accessible to the globally-installed `nest` CLI (which resolves modules from `/usr/local/lib/node_modules/@nestjs/cli/`, not from the project root). Solution: install SWC globally alongside the CLI.
- Root cause of the path alias failure: NestJS CLI reads `tsconfig.build.json` paths via `tsOptions.paths` and injects them into SWC opts (see `swc-defaults.js:L28`). SWC then compiles `@car-rental/permissions` → `../../../../../packages/permissions/src` which doesn't exist at runtime. Fix: set `"paths": {}` in `tsconfig.build.json` so workspace packages are resolved via pnpm symlinks instead.
- Stack: backend `:4000`, frontend `:3000`, postgres `:5434`, redis, mailhog `:8025`

**Commit:** fe5ae66
**PR:** —

---

## [2026-05-15] Phase 2 — Fleet & Customers Frontend Pages

**Phase:** Phase 2 — Fleet & Customers
**Scope:** Frontend CRUD pages for Cars, Customers, and Corporate Accounts; icon library fix (heroicons → lucide-react)
**Files touched:**
- `apps/frontend/src/app/(dashboard)/cars/cars-client.tsx` — Fixed icons (heroicons → lucide-react): Plus, Pencil, Trash2, ArrowLeftRight
- `apps/frontend/src/app/(dashboard)/customers/customers-client.tsx` — New: tabbed Sheet (Info/License/Notes), flag badges, AsyncCombobox for corporate account
- `apps/frontend/src/app/(dashboard)/corporate-accounts/corporate-accounts-client.tsx` — New: CRUD with credit limit/currency display
- `apps/frontend/src/app/(dashboard)/corporate-accounts/page.tsx` — Updated to import CorporateAccountsClient

**Tests:** N/A
**Migration:** None

**Notes:**
- All three pages use lucide-react icons (project standard — @heroicons/react is NOT installed)
- Customers form uses tabbed Sheet: Info tab (personal details, source, flag, corporate link), License tab (primary license on create only), Notes tab (visible + internal notes)
- All dropdowns are Combobox/AsyncCombobox per Tech Rule 1 — no plain selects

**Commit:** 6830dca
**PR:** https://github.com/mg-gouda/iTourCarRental/pull/1

---

## [2026-05-15] Phase 3 — Bookings & Pricing (Backend + Frontend)

**Phase:** Phase 3 — Bookings & Pricing
**Scope:** Full booking lifecycle backend (rate plans, pricing engine, state machine) + Bookings list + Create booking sheet + Calendar view

**Files touched:**
- `apps/backend/prisma/seed.ts` — Added: default extras (GPS, child seat, additional driver, basic/full insurance), Cairo Default rate plan with rules per category, branch pricing settings (young driver threshold, late return grace); booking overlap constraint (graceful fallback if btree_gist unavailable); fixed variable name conflict; fixed `ts-node` invocation path
- `apps/backend/src/modules/rate-plans/` — New: `RatePlansModule`, `RatePlansService`, `RatePlansController`, `dto/rate-plan.dto.ts` — full CRUD for rate plans, rate rules, extras, extra prices
- `apps/backend/src/modules/bookings/pricing.service.ts` — New: 11-step pricing engine per PRICING.md (rate plan resolution, base rental tiers with weekly/monthly, extras, cross-branch fee, mileage overage, late return, age surcharges, fuel charge, discounts, tax, rounding); uses `Prisma.Decimal` throughout
- `apps/backend/src/modules/bookings/bookings.service.ts` — New: full booking state machine (HOLD→CONFIRMED→ACTIVE→COMPLETED + CANCELLED/NO_SHOW); quote(), list(), get(), create(), confirm(), cancel(), checkin(), checkout(), update(), delete(), calendar()
- `apps/backend/src/modules/bookings/bookings.controller.ts` — New: all booking routes; fixed double-prefix (`api/v1/bookings` → `bookings`)
- `apps/backend/src/modules/bookings/dto/booking.dto.ts` — New: CreateBookingDto, UpdateBookingDto, CancelBookingDto, CheckinDto, CheckoutDto, QuoteDto
- `apps/backend/src/modules/bookings/bookings.module.ts` — New
- `apps/backend/src/modules/lookup/lookup.controller.ts` — Extended: rate-plans, extras, available-cars lookup endpoints
- `apps/backend/src/modules/cars/cars.service.ts` — Fixed: `CHECKED_OUT` → `ACTIVE` status
- `apps/backend/src/modules/customers/customers.service.ts` — Fixed: `startAt/endAt` → `pickupAt/returnAt`, `expiryDate` → `expiryAt`, `licenseNumber` → `number`, `issuingCountry` → `country`, `CHECKED_OUT` → `ACTIVE`
- `apps/backend/src/modules/customers/dto/customer.dto.ts` — Fixed: `AdditionalDriverDto` now has `age: number` (model field) not `dateOfBirth`
- `apps/backend/src/modules/rate-plans/rate-plans.controller.ts` — Fixed: double-prefix (`api/v1` → ``)
- `apps/frontend/src/lib/api.ts` — Extended: RatePlan, Extra, RateRule, Booking, PriceBreakdown, CalendarEntry types + ratePlansApi, bookingsApi helpers; extended lookupApi with ratePlans, extras, availableCars
- `apps/frontend/src/app/(dashboard)/bookings/bookings-client.tsx` — New: DataTable with status badges + filters; multi-step Create Booking sheet (customer→car→dates→options→quote); inline Confirm/Cancel actions; QuotePreview component; CancelDialog
- `apps/frontend/src/app/(dashboard)/bookings/page.tsx` — Updated stub to real page
- `apps/frontend/src/app/(dashboard)/calendar/calendar-client.tsx` — New: weekly Gantt timeline grouped by car with hover tooltips, today highlight, week navigation
- `apps/frontend/src/app/(dashboard)/calendar/page.tsx` — Updated stub to real page
- `apps/frontend/src/app/(dashboard)/cars/cars-client.tsx` — Fixed: Combobox `onChange` → `onValueChange`; pagination refactored to `PaginationState`
- `apps/frontend/src/app/(dashboard)/customers/customers-client.tsx` — Same fixes
- `apps/frontend/src/app/(dashboard)/corporate-accounts/corporate-accounts-client.tsx` — Same pagination fixes
- `apps/frontend/src/app/(dashboard)/branches/branches-client.tsx` — Fixed: imported `UpdateBranchDto`; null→undefined sanitization on `defaultValues`
- `apps/frontend/src/app/(dashboard)/staff/staff-client.tsx` — Fixed: `fetchBranches` returns `AsyncOption[]` format
- `apps/frontend/src/app/(dashboard)/system/permissions/permissions-client.tsx` — Fixed: `fetchUsers` returns `AsyncOption[]` format
- `apps/frontend/src/lib/auth.ts` — Fixed: duplicate property spread in authorize()

**Tests:** N/A
**Migration:** No new Prisma migrations (seed adds data only)

**Notes:**
- Booking overlap exclusion constraint skipped in seed (PostgreSQL `tstzrange` IMMUTABLE issue in Docker env) — enforced at service layer with `ConflictException`
- Pricing engine: all amounts in `Prisma.Decimal`, never float; serialized to strings in JSON snapshot
- Create booking is a 3-step sheet: Step 1 (customer+car+dates+branches+driverAge) → Step 2 (fuelPolicy+mileage+notes) → Step 3 (quote preview + confirm)
- Calendar groups bookings by car, 1-week window, Mon–Sun, forward/back navigation, today button
- `DriverLicense` schema uses `number` (not `licenseNumber`), `country` (not `issuingCountry`), `expiryAt` (not `expiryDate`) — DTO field names differ from DB

**Commit:** 588fda6
**PR:** https://github.com/mg-gouda/iTourCarRental/pull/2

---

## [2026-05-16] Phase 4 — Money (Payments, Invoices, Refunds, Damage & Fines)

**Phase:** Phase 4 — Money
**Scope:** Full Payments, Invoices, Refunds, and Damage & Fines modules (backend + frontend)

**Files touched:**
- `apps/backend/src/modules/payments/` — New: PaymentsModule, PaymentsService (idempotency, void), PaymentsController, dto/payment.dto.ts
- `apps/backend/src/modules/invoices/` — New: InvoicesModule, InvoicesService (invoice generation from priceSnapshot, invoice numbering, credit notes), InvoicesController, dto/invoice.dto.ts
- `apps/backend/src/modules/refunds/` — New: RefundsModule, RefundsService (two-person rule, cancellation policy tiers, auto-approve below threshold), RefundsController, dto/refund.dto.ts
- `apps/backend/src/modules/damage-fines/` — New: DamageFinesModule, DamageFinesService, DamageFinesController, dto/damage-fine.dto.ts
- `apps/backend/src/modules/lookup/lookup.controller.ts` — Extended: `GET /lookup/bookings` for async combo-box booking search
- `apps/backend/src/modules/bookings/bookings.service.ts` — Fixed: `Prisma.InputJsonValue` → `InputJsonValue` from runtime/library; `Prisma.BookingWhereInput` → plain `Record<string, unknown>`; implicit `any` in callbacks
- `apps/backend/src/modules/bookings/pricing.service.ts` — Fixed: `Prisma.Decimal` → `Decimal` from runtime/library; implicit `any` in callbacks
- `apps/backend/src/modules/cars/cars.service.ts` — Fixed: same `Decimal` import
- `apps/backend/src/modules/corporate-accounts/corporate-accounts.service.ts` — Same
- `apps/backend/src/modules/damage-fines/damage-fines.service.ts` — Same
- `apps/backend/src/modules/insurance/insurance.service.ts` — Same
- `apps/backend/src/modules/invoices/invoices.service.ts` — Fixed: `InputJsonValue` import
- `apps/backend/src/modules/customers/customers.service.ts` — Fixed implicit `any` in tx callbacks
- `apps/backend/src/modules/permissions/permissions.service.ts` — Fixed implicit `any` and `{}` not assignable to `boolean`
- `apps/backend/src/modules/settings/settings.service.ts` — Fixed implicit `any`
- `apps/backend/src/common/guards/auth.guard.ts` — Fixed implicit `any`
- `apps/backend/src/modules/auth/auth.service.ts` — Fixed implicit `any`
- `apps/backend/src/modules/audit-log/audit-log.service.ts` — Fixed implicit `any`
- `apps/backend/src/app.module.ts` — Added PaymentsModule, InvoicesModule, RefundsModule, DamageFinesModule
- `apps/frontend/src/lib/api.ts` — Extended: Payment, Invoice, CreditNote, Refund, DamageRecord, Fine types + paymentsApi, invoicesApi, refundsApi, damageFinesApi; lookupApi.bookings
- `apps/frontend/src/app/(dashboard)/payments/payments-client.tsx` — New: DataTable + kind filter + Record Payment sheet + Void dialog
- `apps/frontend/src/app/(dashboard)/payments/page.tsx` — Updated stub to real page
- `apps/frontend/src/app/(dashboard)/invoices/invoices-client.tsx` — New: DataTable + kind filter + Generate Invoice sheet + Invoice Detail sheet + Credit Note sheet + Void dialog
- `apps/frontend/src/app/(dashboard)/invoices/page.tsx` — Updated
- `apps/frontend/src/app/(dashboard)/damage-fines/damage-fines-client.tsx` — New: tabbed Damage/Fines DataTables + Record Damage sheet + Record Fine sheet + Delete confirm dialog
- `apps/frontend/src/app/(dashboard)/damage-fines/page.tsx` — Updated
- `apps/frontend/src/components/ui/textarea.tsx` — New: shadcn-style Textarea component

**Tests:** N/A
**Migration:** No — all Phase 4 Prisma models were already in schema

**Notes:**
- `Prisma.Decimal` and `Prisma.InputJsonValue` do NOT exist in Prisma 6 with this client setup; use `Decimal` / `InputJsonValue` from `@prisma/client/runtime/library` directly
- `Prisma.XyzWhereInput` types not exported either — use `any` for where clause types
- Refunds: auto-approve if amount < `two_person_refund_threshold` setting; two-person rule enforced otherwise (approver ≠ requester)
- Invoice numbering: `{BRANCH_CODE}-{YEAR}-{0001}` — sequence per branch/year via count() on invoice table
- `lookupApi.bookings` endpoint added: returns `{ id, bookingNumber, customer: { fullName } }` — used by payment/invoice/damage-fine async comboboxes
- No PDF generation yet — stubbed as 501 Not Implemented in invoices service

**Commit:** TBD
**PR:** TBD
