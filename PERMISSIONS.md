# Permissions Model

The permissions system controls who can see and do what across the dashboard. It combines role defaults with per-user overrides and gates access at three levels: page, action, and field.

---

## Golden Rules

1. **Backend is the only enforcer.** The frontend uses permissions to hide/disable UI. Every API request re-checks permissions server-side. Frontend gating is UX, not security.
2. **Resolver lives in two places.** Identical logic runs on the backend (enforcement) and frontend (UI). Keep them in sync. Generate types and ship the resolver as a shared package or duplicate carefully with a shared test suite.
3. **Every permission change is audit-logged** with actor, target, before, after.
4. **Branch scope is enforced separately.** A user might have `bookings.delete` permission, but if they're scoped to "Cairo," they cannot delete a Hurghada booking. Permission check + branch check are both required for branch-scoped roles.
5. **Default deny.** If no rule grants a permission, it's denied. Overrides explicitly grant or revoke.

---

## Concepts

### Permission
A permission is a triple: `page.action.field?`.

- **Page** — a logical area of the dashboard (`bookings`, `cars`, `invoices`, `system.permissions`, etc.).
- **Action** — what can be done on that page. Standard actions: `view`, `create`, `edit`, `delete`, `export`. Domain-specific actions per page: `bookings.cancel`, `bookings.refund`, `cars.transfer`, `users.impersonate`.
- **Field** — optional, for hiding/showing specific fields. Example: `bookings.view.cost_breakdown` lets Staff view bookings but hides the cost lines.

Examples of full permission keys:
- `bookings.view`
- `bookings.edit`
- `bookings.cancel`
- `bookings.view.cost_breakdown`
- `system.permissions.edit`

### Role
A named bundle of permission defaults. The seeded roles are:

- **Super Admin** — all permissions across all pages, fields, actions.
- **Branch Manager** — full access scoped to one branch; cannot edit other branches' data, cannot manage system parameters except viewing.
- **Staff / Agent** — bookings (create, edit, view), customers (create, edit, view), payments (record), inspections (create). No financial reporting beyond their bookings. Cost fields hidden.
- **Accountant** — payments, refunds, invoices, credit notes, financial reports. Read-only on bookings, customers, cars. No fleet edits.
- **Mechanic** — maintenance records (create, edit, complete), cars (view-only), accidents (create, edit). Nothing else.
- **Customer** — no admin UI access in v1.

### Override
A per-user grant or revocation that sits on top of the role default.

- **Grant** — explicitly enables a permission that the role doesn't have.
- **Revoke** — explicitly removes a permission that the role does have.

Overrides are scoped to a single user and persist independently of the role. If the role's defaults later change, overrides still apply on top.

### Effective Permission
The final answer for "can this user do this action?" — computed by the resolver each request.

---

## Resolution Algorithm

```ts
function canDo(user: User, key: string): boolean {
  // 1. Hard deny if no active session
  if (!user.session.valid) return false;

  // 2. Super Admin bypasses all checks (but is still audit-logged)
  if (user.role === 'super_admin') return true;

  // 3. Start with role default
  const roleHas = ROLE_DEFAULTS[user.role].has(key);

  // 4. Apply per-user overrides
  const override = user.overrides[key]; // 'grant' | 'revoke' | undefined
  if (override === 'grant') return true;
  if (override === 'revoke') return false;

  // 5. Default to role
  return roleHas;
}
```

For a complete user, the resolver produces a flat `Set<string>` of effective permissions. This set is:

- Cached per-user, invalidated on any permission change.
- Sent to the frontend on session establishment and on permission updates.
- Re-checked server-side on every protected request.

Branch scope is **separate** from the permission check:

```ts
function canDoOn(user: User, key: string, resource: { branchId: string }): boolean {
  if (!canDo(user, key)) return false;
  if (user.role === 'super_admin') return true;
  if (user.branchScope.includes(resource.branchId)) return true;
  return false;
}
```

A Branch Manager scoped to "Cairo" attempting to edit a Hurghada booking fails the second check even though they have `bookings.edit`.

---

## Field-Level Permissions

Field-level keys use the form `page.action.field`. For each protected field, the resolver answers `canDo(user, 'bookings.view.cost_breakdown')`.

**Backend enforcement**: response serializers strip non-permitted fields from the API response. The field never reaches the wire.

**Frontend enforcement**: UI checks the permission and hides the field in tables, forms, and details. If it somehow slips through, the backend has already stripped it.

Implementation pattern (NestJS):
- A class-transformer plugin reads `@PermissionGated('bookings.view.cost_breakdown')` decorators on DTO fields.
- The interceptor strips decorated fields the user lacks permission for.

---

## Page Access

`page.view` is the gate to load the page. The frontend's middleware reads the user's permission set and redirects to a "no access" page if `view` is missing.

The sidebar/navigation only renders entries the user has `.view` on. No empty links, no "access denied" surprises mid-flow.

---

## Action Permissions and Buttons

A button or menu item that triggers an action is disabled (and hidden, ideally) when the user lacks the corresponding permission.

Examples:
- `bookings.cancel` missing → "Cancel booking" button not rendered.
- `bookings.refund` missing → "Issue refund" menu item not rendered.
- `cars.transfer` missing → "Transfer to another branch" hidden.

Backend re-checks on the endpoint. UI hiding is a courtesy.

---

## Permissions Page UI (`/system/permissions`)

Two tabs: **Roles** and **Users**.

### Roles tab
- List of roles.
- Click a role → matrix of all pages (rows) × actions (columns) with checkboxes.
- Field-level permissions appear as an expandable sub-row under the page row.
- Save publishes a new role version; old user sessions revalidate against the new role on their next request.
- Super Admin role is read-only (cannot be downgraded — bricking risk).

### Users tab
- List of users with their role and override count.
- Click a user → effective permissions matrix.
  - Cells from the role show as "inherited" (light state).
  - Overrides show as "granted" (green) or "revoked" (red), with the inherited state visible underneath.
- Toggle a cell to add/remove an override.
- Bulk: "Reset to role defaults" clears all overrides for a user.

### Audit
- Every save (role default change, override grant/revoke) creates an audit entry: actor, target (role or user), key, before, after, timestamp.
- Filterable from `/audit-log`.

---

## Seeded Permission Defaults

The seed migration creates the default permission set for each role. Below is the intended baseline — change requires explicit decision.

### Pages (rows) × Actions (columns)

| Page                    | Super Admin | Branch Manager | Staff/Agent | Accountant | Mechanic |
|-------------------------|-------------|----------------|-------------|------------|----------|
| `dashboard`             | full        | view+          | view+       | view+      | view+    |
| `calendar`              | full        | full*          | view+edit   | view       | view     |
| `cars`                  | full        | full*          | view        | view       | view     |
| `bookings`              | full        | full*          | full*       | view       | —        |
| `customers`             | full        | full*          | full*       | view       | —        |
| `corporate-accounts`    | full        | view           | view        | full       | —        |
| `payments`              | full        | view           | create+view | full       | —        |
| `invoices`              | full        | view           | view        | full       | —        |
| `damage-fines`          | full        | full*          | create+view | full       | —        |
| `maintenance`           | full        | view           | view        | view       | full     |
| `maintenance/vendors`   | full        | view           | —           | view       | full     |
| `parts`                 | full        | view           | —           | view       | full     |
| `accidents`             | full        | view           | view        | view       | full     |
| `insurance`             | full        | view           | view        | view       | view     |
| `branches`              | full        | view (own)     | view (own)  | view       | view     |
| `staff`                 | full        | view (own)     | view (own)  | view       | view     |
| `reports`               | full        | scoped         | own bookings| financial  | maintenance |
| `audit-log`             | full        | scoped         | —           | scoped     | —        |
| `system.permissions`    | full        | view           | —           | —          | —        |
| `system.styling`        | full        | —              | —           | —          | —        |
| `system.settings`       | full        | view           | —           | —          | —        |
| `profile`               | full        | full           | full        | full       | full     |
| `help`                  | view        | view           | view        | view       | view     |

Notes:
- `full*` = full within branch scope.
- `view+` = view, possibly with role-adapted summary (the dashboard adapts per role).
- `scoped` = visible within the user's branch only.

### Field-level defaults
- `bookings.view.cost_breakdown` — Staff: revoked. Mechanic: revoked.
- `bookings.view.profit_margin` — Staff: revoked. Branch Manager: granted. Accountant: granted.
- `customers.view.blacklist_reason` — Staff: revoked. Branch Manager: granted.
- `cars.view.purchase_cost` — Staff: revoked. Mechanic: revoked. Accountant: granted.

### Domain-specific actions (defaults)
- `bookings.cancel` — Super Admin, Branch Manager, Staff (within branch).
- `bookings.refund` — Super Admin, Accountant, Branch Manager (with two-person rule above threshold).
- `bookings.delete` — Super Admin only.
- `cars.transfer` — Super Admin, Branch Manager.
- `users.impersonate` — Super Admin only (audit-logged with extra emphasis).
- `payments.void` — Super Admin, Accountant.

---

## API Implementation

NestJS guards + decorators:

```ts
@Controller('bookings')
@UseGuards(AuthGuard, PermissionGuard)
class BookingsController {
  @Get(':id')
  @Permissions('bookings.view')
  @BranchScoped('booking')   // reads booking, checks user.branchScope
  findOne(@Param('id') id: string) { ... }

  @Post(':id/cancel')
  @Permissions('bookings.cancel')
  @BranchScoped('booking')
  @AuditLog('booking.cancel')
  cancel(@Param('id') id: string) { ... }
}
```

The `PermissionGuard` loads the user's effective permission set from cache and short-circuits with 403 if any required permission is missing.

`BranchScoped('booking')` is a decorator that, combined with a `BranchScopeInterceptor`, looks up the resource's branch and validates against `user.branchScope`.

---

## Frontend Implementation

A single `usePermission(key)` hook reads from the permission set received at login:

```tsx
const canCancel = usePermission('bookings.cancel');
{canCancel && <Button onClick={cancel}>Cancel</Button>}
```

For field-level:

```tsx
const showCost = usePermission('bookings.view.cost_breakdown');
{showCost && <CostBreakdown booking={booking} />}
```

For page-level routing, `middleware.ts` checks `usePermission('<page>.view')` server-side before rendering.

---

## Edge Cases

- **Role change mid-session.** When an admin changes a user's role, the user's cached permission set is invalidated. The next request triggers a re-resolve. The user might keep an open page that suddenly shows a 403 on the next action — that's correct.
- **Override of a permission the role gains later.** A user revoked from `bookings.delete` keeps that revocation even if the role's default changes to grant it. Explicit overrides win until cleared.
- **Super Admin's last permission.** The UI prevents removing the last `system.permissions.edit` permission from the system (otherwise the system becomes unmanageable). Super Admin role itself cannot be deleted.
- **Branch transfer.** When a user is moved to a new branch, their `branchScope` updates; their permission set doesn't change. Existing bookings in the old branch become invisible until they're re-scoped or the role is upgraded.
- **Multi-branch users.** A Branch Manager can be scoped to multiple branches. `branchScope` is an array, not a single value.

---

## Testing

- Unit tests for the resolver covering: role-only, role + grant, role + revoke, grant overriding role-deny, revoke overriding role-grant, Super Admin bypass, default-deny for unknown keys.
- Integration tests per endpoint covering: missing permission → 403, wrong branch → 403, granted via override → 200.
- Snapshot test of the seeded default matrix to prevent accidental loosening of permissions.
