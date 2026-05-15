# Pricing Engine

The pricing engine resolves the total cost of a booking from base rates, extras, fees, discounts, and taxes — and it's where most "weird bugs that cost money" come from. Read this before touching any pricing code.

---

## Golden Rules

1. **Snapshot at confirmation.** Every booking, invoice, and refund stores the full price breakdown at the moment it was issued. Once snapshotted, those numbers are immutable. They are never recomputed from live rates, rate plans, or policies.
2. **Single source of truth.** The pricing engine is one service (`PricingService` in the bookings module). All callers — booking creation, modification, quote endpoint — go through it. No ad-hoc math elsewhere.
3. **Determinism.** Given the same inputs, the pricing engine produces the same output. No `Date.now()` inside the math — pass in the reference time.
4. **Currency rounding once, at the end.** Internal math in cents (or smallest currency unit) as integers or `Decimal`. Float math is forbidden.
5. **Every charge has a line item.** Nothing is rolled silently into a total. The line items are what the customer sees on the invoice.
6. **Tax is calculated last.** All base + extras + fees + discounts resolve first; tax applies on the taxable subtotal per branch rules.

---

## Inputs

The pricing engine takes:

```ts
type PricingInput = {
  carId: string;
  pickupBranchId: string;
  returnBranchId: string;
  pickupAt: DateTime;     // UTC
  returnAt: DateTime;     // UTC
  driverAge: number;
  additionalDrivers: { age: number }[];
  extras: { extraId: string; quantity: number }[];
  fuelPolicy: 'full_to_full' | 'prepaid_full' | 'return_as_received';
  mileageAllowancePerDay: number | 'unlimited';
  expectedMileage?: number;            // used only for quote previews
  promoCode?: string;
  corporateAccountId?: string;
  referenceTime: DateTime;             // when this calculation is happening
};
```

## Output

```ts
type PriceBreakdown = {
  currency: string;
  lineItems: LineItem[];
  subtotal: number;
  discountTotal: number;
  taxableSubtotal: number;
  taxLines: TaxLine[];
  taxTotal: number;
  total: number;
  ratePlanId: string;            // which plan was applied
  ratePlanVersion: number;       // for audit
  computedAt: DateTime;
};
```

Each line item:

```ts
type LineItem = {
  kind: 'base_rental' | 'extra' | 'cross_branch_fee' | 'mileage_overage'
      | 'late_return' | 'age_surcharge' | 'fuel_charge' | 'discount';
  description: string;           // localized; key + params stored
  quantity: number;
  unitAmount: number;            // in cents
  amount: number;                // in cents (quantity * unitAmount, signed)
  taxable: boolean;
};
```

---

## Resolution Order

The engine resolves in this exact order. Order matters — changing it changes outcomes.

### 1. Resolve the rate plan
- Find the rate plan applicable to: `pickupBranchId`, the pickup/return date window, and (if present) the `corporateAccountId`.
- Precedence: corporate plan > seasonal/holiday plan > default branch plan.
- If multiple non-corporate plans overlap the rental window, the one with the **narrower date window** wins (more specific beats more general).
- Record the resolved `ratePlanId` and `ratePlanVersion`.

### 2. Compute base rental
- Determine rental duration in days. Day count rules:
  - 24-hour billing days from `pickupAt`.
  - Partial days round up at the daily threshold defined by the branch (default: 1 hour grace, then a new day starts).
  - Returns longer than 7 days may roll into weekly tiers if the plan defines them; 30+ days into monthly tiers.
- Apply the tier that produces the lowest cost for the customer (this is a configurable strategy — "best tier" vs "strict tier" — set in branch settings). Default: **best tier for customer**.
- Emit one or more `base_rental` line items (e.g., "2 weeks + 3 days").

### 3. Add extras
- For each extra, look up the price from the rate plan (extras can be plan-specific) or fall back to the global extra price.
- Extras priced per-day, per-rental, or per-unit — defined on the extra itself.
- Additional driver fee is an extra of `kind = additional_driver` priced per driver per day.
- Emit one `extra` line item per extra.

### 4. Cross-branch return fee
- If `pickupBranchId !== returnBranchId`, look up the fee from a branch-pair fee table (or fall back to a default).
- Emit one `cross_branch_fee` line item.

### 5. Mileage overage (deferred to return)
- At booking time, `mileage_overage` is **not** charged unless the booking is a quote/preview showing expected overage.
- At return inspection, compute `actual_km - allowed_km` and add a `mileage_overage` line item to the **final invoice** (booking is re-priced for the final invoice).
- Allowed km = `mileageAllowancePerDay × billed_days` (`unlimited` → never emit overage).

### 6. Late return penalty (deferred to return)
- If `actualReturnAt > returnAt + grace`, emit a `late_return` line item.
- Grace period and penalty rate (per hour, per day, or hybrid) come from branch settings.

### 7. Age surcharges
- For the primary driver and each additional driver under the branch's young-driver threshold (default: 25), apply the young-driver surcharge.
- For drivers over the senior threshold (if configured), apply the senior surcharge.
- Emit one `age_surcharge` line item per qualifying driver.

### 8. Fuel charge (deferred to return for `return_as_received`)
- `full_to_full`: no upfront charge; charge at return only if returned below full, computed from inspection.
- `prepaid_full`: emit a `fuel_charge` line item at booking confirmation for the full-tank prepay.
- `return_as_received`: charge at return based on the delta in fuel level × per-litre rate.

### 9. Apply discounts
- Promo code: lookup, validate (not expired, usage limits, applicable to this booking).
- Corporate-account discount: applies to base + extras unless the plan says otherwise.
- Discounts are **negative line items** (`kind = discount`). They never silently reduce other line items.
- Stacking rules: configurable per promo (e.g., "not combinable with corporate discount"). Engine emits a clear error if a stacking violation occurs.

### 10. Compute taxable subtotal and taxes
- Each line item has a `taxable` flag (most are taxable; some fees may not be, per branch tax config).
- Taxable subtotal = sum of taxable line items (after discounts that were marked as reducing taxable basis).
- For each applicable tax (VAT, city tax, etc., per branch): compute and emit a `TaxLine`.
- Tax-inclusive branches: the displayed line item prices already include tax, and the engine back-computes the tax portion for reporting.

### 11. Round
- Round each tax line and the final total per branch currency rules (typically two decimal places).
- Sum cross-checks: `subtotal - discountTotal + taxTotal === total` must hold to the cent.

---

## Quote vs Confirmation vs Final

The engine runs in three contexts:

| Context       | Inputs known           | Snapshot? | Notes                                       |
|---------------|------------------------|-----------|---------------------------------------------|
| Quote         | All except actuals     | No        | Used for previews; can show overage/late as "if returned at X" |
| Confirmation  | All except actuals     | **Yes**   | Snapshotted to the booking                  |
| Final invoice | Includes actual return | **Yes**   | Snapshotted to the invoice; can differ from booking snapshot due to actuals |

At final-invoice time, the engine reruns with actual return data. The original booking snapshot stays untouched — the invoice gets its own snapshot. The difference between booking total and invoice total is normal and expected (overage, late fees, fuel adjustments).

---

## Modifications

A booking modification (extension, car swap, branch change) re-runs the engine with the new inputs and produces a **new snapshot**, attached to the modification record. The original snapshot is preserved on the booking; the active price is the latest modification's snapshot.

---

## Refunds & Cancellations

Refund amounts are computed by the **Cancellation Policy**, not the pricing engine. The cancellation policy is a tiered rule:

```
> 48 hours before pickup → 100% refund
24–48 hours              → 50%
< 24 hours / no_show     → 0%
```

(Defaults configurable per branch.) The refund creates a credit note line-item-for-line-item against the original invoice, then a negative-total refund record.

---

## Worked Example

**Inputs**
- Car: Economy, daily rate 200 EGP
- Pickup: Cairo branch, Mon 09:00; Return: Hurghada branch, Fri 09:00 (4 days)
- Driver age: 22 (Cairo young-driver surcharge: 50 EGP/day)
- 1 additional driver (50 EGP/day extra)
- Extra: GPS (30 EGP/day)
- Fuel policy: `prepaid_full` (200 EGP)
- No promo, no corporate
- Cairo branch VAT: 14%, exclusive

**Resolution**
1. Rate plan: Cairo default, 200 EGP/day. No weekly tier triggers.
2. Base rental: 4 × 200 = 800
3. Extras: GPS 4 × 30 = 120; additional driver 4 × 50 = 200
4. Cross-branch fee (Cairo → Hurghada): 250
5. Mileage overage: deferred
6. Late return: deferred
7. Age surcharge: 4 × 50 = 200
8. Fuel charge: 200 (prepaid)
9. Discount: 0
10. Taxable subtotal: 800 + 120 + 200 + 250 + 200 + 200 = 1,770 EGP. VAT 14% = 247.80
11. Total: 2,017.80 EGP

Stored as 11 line items + 1 tax line in the booking snapshot.

---

## Implementation Notes

- Implement as a pure function over inputs + a `PricingContext` (rate plans, extras, branch config, promo) loaded at the entry point. Pure makes it trivially testable.
- Unit tests must cover: tier boundaries, cross-branch combinations, mixed-age driver groups, promo stacking, tax-inclusive vs exclusive branches, currency rounding edge cases.
- Property-based tests for the cross-check invariant `subtotal - discountTotal + taxTotal === total`.
- Never use floating-point arithmetic. Use `Prisma.Decimal` or integer cents throughout.
