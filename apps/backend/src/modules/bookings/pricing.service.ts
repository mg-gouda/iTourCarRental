import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

// All money in smallest unit (cents-equivalent); Decimal throughout.

export interface PricingInput {
  carId: string;
  pickupBranchId: string;
  returnBranchId: string;
  pickupAt: Date;
  returnAt: Date;
  driverAge: number;
  additionalDrivers: { age: number }[];
  extras: { extraId: string; quantity: number }[];
  fuelPolicy: 'FULL_TO_FULL' | 'PREPAID_FULL' | 'RETURN_AS_RECEIVED';
  mileageAllowancePerDay: number | null; // null = unlimited
  promoCode?: string;
  corporateAccountId?: string;
  referenceTime: Date;
  // Return actuals (only for final-invoice run)
  actualReturnAt?: Date;
  actualKm?: number;
  actualFuelLevel?: number; // 0–100; only for FULL_TO_FULL / RETURN_AS_RECEIVED
}

export interface LineItem {
  kind: 'base_rental' | 'extra' | 'cross_branch_fee' | 'mileage_overage' | 'late_return' | 'age_surcharge' | 'fuel_charge' | 'discount';
  description: string;
  quantity: number;
  unitAmount: Decimal;
  amount: Decimal; // quantity × unitAmount, signed
  taxable: boolean;
}

export interface TaxLine {
  label: string;
  rate: Decimal;
  taxableAmount: Decimal;
  taxAmount: Decimal;
}

export interface PriceBreakdown {
  currency: string;
  lineItems: LineItem[];
  subtotal: Decimal;
  discountTotal: Decimal;
  taxableSubtotal: Decimal;
  taxLines: TaxLine[];
  taxTotal: Decimal;
  total: Decimal;
  ratePlanId: string;
  ratePlanVersion: number;
  billedDays: number;
  computedAt: Date;
}

function d(v: number | string): Decimal {
  return new Decimal(v);
}

@Injectable()
export class PricingService {
  constructor(private readonly prisma: PrismaService) {}

  async quote(input: PricingInput): Promise<PriceBreakdown> {
    // ── 1. Resolve rate plan ─────────────────────────────────────────────────
    const ratePlan = await this.resolveRatePlan(input);
    const car = await this.prisma.car.findUniqueOrThrow({
      where: { id: input.carId },
      select: { categoryId: true, homeBranchId: true },
    });
    const rule = ratePlan.rules.find((r: any) => r.categoryId === car.categoryId);
    if (!rule) throw new Error(`No rate rule for this car category in rate plan '${ratePlan.name}'`);

    const branch = await this.prisma.branch.findUniqueOrThrow({
      where: { id: input.pickupBranchId },
      select: { taxRate: true, taxInclusive: true, defaultCurrency: true },
    });

    const currency = rule.currency;
    const lineItems: LineItem[] = [];

    // ── 2. Base rental ───────────────────────────────────────────────────────
    const { days: billedDays, items: baseItems } = this.computeBaseRental(
      input.pickupAt,
      input.actualReturnAt ?? input.returnAt,
      rule,
      currency,
    );
    lineItems.push(...baseItems);

    // ── 3. Extras ────────────────────────────────────────────────────────────
    for (const e of input.extras) {
      const extraDef = await this.prisma.extra.findUnique({ where: { id: e.extraId } });
      if (!extraDef || !extraDef.isActive) continue;
      const priceRow = ratePlan.extras.find((ep: any) => ep.extraId === e.extraId);
      if (!priceRow) continue;
      const unitAmt = new Decimal(priceRow.amount);
      const qty = extraDef.pricingMode === 'per_day' ? e.quantity * billedDays : e.quantity;
      lineItems.push({
        kind: 'extra',
        description: extraDef.name,
        quantity: qty,
        unitAmount: unitAmt,
        amount: unitAmt.mul(qty),
        taxable: true,
      });
    }

    // ── 4. Cross-branch fee ──────────────────────────────────────────────────
    if (input.pickupBranchId !== input.returnBranchId) {
      const fee = await this.prisma.crossBranchFee.findUnique({
        where: { fromBranchId_toBranchId: { fromBranchId: input.pickupBranchId, toBranchId: input.returnBranchId } },
      });
      if (fee) {
        lineItems.push({
          kind: 'cross_branch_fee',
          description: 'Cross-branch return fee',
          quantity: 1,
          unitAmount: new Decimal(fee.amount),
          amount: new Decimal(fee.amount),
          taxable: true,
        });
      }
    }

    // ── 5. Mileage overage (only at final invoice) ───────────────────────────
    if (input.actualKm != null && input.mileageAllowancePerDay != null) {
      const allowedKm = input.mileageAllowancePerDay * billedDays;
      const overageKm = input.actualKm - allowedKm;
      if (overageKm > 0) {
        const kmRate = await this.getSettingValue<number>(`branch_${input.pickupBranchId}_mileage_overage_rate`, 2);
        const amt = d(kmRate).mul(overageKm);
        lineItems.push({ kind: 'mileage_overage', description: `Mileage overage (${overageKm} km)`, quantity: overageKm, unitAmount: d(kmRate), amount: amt, taxable: true });
      }
    }

    // ── 6. Late return (only at final invoice) ───────────────────────────────
    if (input.actualReturnAt && input.actualReturnAt > input.returnAt) {
      const graceMs = 60 * 60 * 1000; // 1 hour default grace
      const lateMs = input.actualReturnAt.getTime() - input.returnAt.getTime() - graceMs;
      if (lateMs > 0) {
        const lateHours = Math.ceil(lateMs / (60 * 60 * 1000));
        const penaltyRate = await this.getSettingValue<number>(`branch_${input.pickupBranchId}_late_return_rate`, Number(rule.dailyRate) / 24);
        const amt = d(penaltyRate).mul(lateHours);
        lineItems.push({ kind: 'late_return', description: `Late return (${lateHours}h)`, quantity: lateHours, unitAmount: d(penaltyRate), amount: amt, taxable: true });
      }
    }

    // ── 7. Age surcharges ────────────────────────────────────────────────────
    const youngDriverSetting = await this.getSettingValue<{ threshold: number; surchargePerDay: number } | null>(
      `branch_${input.pickupBranchId}_young_driver_age`, null,
    );
    if (youngDriverSetting) {
      const allDrivers = [{ age: input.driverAge }, ...input.additionalDrivers];
      for (const driver of allDrivers) {
        if (driver.age < youngDriverSetting.threshold) {
          const amt = d(youngDriverSetting.surchargePerDay).mul(billedDays);
          lineItems.push({ kind: 'age_surcharge', description: `Young driver surcharge (age ${driver.age})`, quantity: billedDays, unitAmount: d(youngDriverSetting.surchargePerDay), amount: amt, taxable: true });
        }
      }
    }

    // ── 8. Fuel charge ───────────────────────────────────────────────────────
    if (input.fuelPolicy === 'PREPAID_FULL') {
      const fuelRate = await this.getSettingValue<number>(`branch_${input.pickupBranchId}_prepaid_fuel_rate`, 200);
      lineItems.push({ kind: 'fuel_charge', description: 'Prepaid full tank', quantity: 1, unitAmount: d(fuelRate), amount: d(fuelRate), taxable: true });
    } else if (input.fuelPolicy === 'FULL_TO_FULL' && input.actualFuelLevel != null && input.actualFuelLevel < 100) {
      const deficit = 100 - input.actualFuelLevel;
      const fuelRate = await this.getSettingValue<number>(`branch_${input.pickupBranchId}_fuel_per_pct_rate`, 5);
      const amt = d(fuelRate).mul(deficit);
      lineItems.push({ kind: 'fuel_charge', description: `Fuel deficit (${deficit}%)`, quantity: deficit, unitAmount: d(fuelRate), amount: amt, taxable: true });
    }

    // ── 9. Discounts ─────────────────────────────────────────────────────────
    if (input.promoCode) {
      const promo = await this.prisma.promoCode.findFirst({
        where: { code: input.promoCode, isActive: true, validFrom: { lte: input.referenceTime }, validUntil: { gte: input.referenceTime } },
      });
      if (promo) {
        const preDiscountTotal = lineItems.reduce((s, li) => s.add(li.amount), d(0));
        const discountAmt = promo.discountType === 'percent'
          ? preDiscountTotal.mul(promo.amount).div(100)
          : new Decimal(promo.amount);
        lineItems.push({ kind: 'discount', description: `Promo: ${promo.code}`, quantity: 1, unitAmount: discountAmt.neg(), amount: discountAmt.neg(), taxable: false });
      }
    }

    // ── 10. Tax ──────────────────────────────────────────────────────────────
    const subtotal = lineItems.reduce((s, li) => s.add(li.amount), d(0));
    const discountTotal = lineItems.filter((li) => li.kind === 'discount').reduce((s, li) => s.add(li.amount.abs()), d(0));
    const taxableSubtotal = lineItems.filter((li) => li.taxable).reduce((s, li) => s.add(li.amount), d(0));

    const taxLines: TaxLine[] = [];
    const taxRate = new Decimal(branch.taxRate);
    if (taxRate.gt(0)) {
      const taxAmt = branch.taxInclusive
        ? taxableSubtotal.mul(taxRate).div(d(1).add(taxRate))
        : taxableSubtotal.mul(taxRate);
      taxLines.push({ label: 'VAT', rate: taxRate, taxableAmount: taxableSubtotal, taxAmount: taxAmt.toDecimalPlaces(2) });
    }

    // ── 11. Round ─────────────────────────────────────────────────────────────
    const taxTotal = taxLines.reduce((s, t) => s.add(t.taxAmount), d(0));
    const total = branch.taxInclusive ? subtotal : subtotal.add(taxTotal);

    return {
      currency,
      lineItems,
      subtotal: subtotal.toDecimalPlaces(2),
      discountTotal: discountTotal.toDecimalPlaces(2),
      taxableSubtotal: taxableSubtotal.toDecimalPlaces(2),
      taxLines,
      taxTotal: taxTotal.toDecimalPlaces(2),
      total: total.toDecimalPlaces(2),
      ratePlanId: ratePlan.id,
      ratePlanVersion: ratePlan.version,
      billedDays,
      computedAt: input.referenceTime,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────────

  private async resolveRatePlan(input: PricingInput) {
    // Corporate plan takes highest precedence
    if (input.corporateAccountId) {
      const corp = await this.prisma.ratePlan.findFirst({
        where: {
          corporateAccountId: input.corporateAccountId,
          isActive: true,
          startAt: { lte: input.pickupAt },
          endAt: { gte: input.returnAt },
        },
        include: { rules: true, extras: true },
        orderBy: { priority: 'desc' },
      });
      if (corp) return corp;
    }

    // Narrowest applicable plan wins (most specific date window)
    const plans = await this.prisma.ratePlan.findMany({
      where: {
        isActive: true,
        corporateAccountId: null,
        OR: [{ branchId: input.pickupBranchId }, { branchId: null }],
        startAt: { lte: input.pickupAt },
        endAt: { gte: input.returnAt },
      },
      include: { rules: true, extras: true },
      orderBy: [{ priority: 'desc' }, { startAt: 'desc' }],
    });

    if (plans.length === 0) throw new Error('No applicable rate plan found for the given dates and branch');

    // Among tied priorities, pick narrowest window
    plans.sort((a: any, b: any) => {
      if (b.priority !== a.priority) return b.priority - a.priority;
      const aDur = a.endAt.getTime() - a.startAt.getTime();
      const bDur = b.endAt.getTime() - b.startAt.getTime();
      return aDur - bDur; // narrower wins
    });

    return plans[0];
  }

  private computeBaseRental(
    pickupAt: Date,
    returnAt: Date,
    rule: { dailyRate: Decimal; weeklyRate: Decimal | null; monthlyRate: Decimal | null },
    currency: string,
  ): { days: number; items: LineItem[] } {
    const msPerDay = 24 * 60 * 60 * 1000;
    const msPerHour = 60 * 60 * 1000;
    const durationMs = returnAt.getTime() - pickupAt.getTime();

    const fullDays = Math.floor(durationMs / msPerDay);
    const remainderMs = durationMs % msPerDay;
    // Partial day: 1h grace, then new day
    const graceMs = msPerHour;
    const billedDays = remainderMs > graceMs ? fullDays + 1 : Math.max(fullDays, 1);

    const items: LineItem[] = [];

    if (rule.monthlyRate && billedDays >= 30) {
      const months = Math.floor(billedDays / 30);
      const remDays = billedDays % 30;

      if (months > 0) {
        const monthlyAmt = new Decimal(rule.monthlyRate).mul(months);
        items.push({ kind: 'base_rental', description: `${months} month${months > 1 ? 's' : ''}`, quantity: months, unitAmount: new Decimal(rule.monthlyRate), amount: monthlyAmt, taxable: true });
      }
      if (remDays > 0) {
        const dailyAmt = new Decimal(rule.dailyRate).mul(remDays);
        items.push({ kind: 'base_rental', description: `${remDays} day${remDays > 1 ? 's' : ''}`, quantity: remDays, unitAmount: new Decimal(rule.dailyRate), amount: dailyAmt, taxable: true });
      }
    } else if (rule.weeklyRate && billedDays >= 7) {
      const weeks = Math.floor(billedDays / 7);
      const remDays = billedDays % 7;

      if (weeks > 0) {
        const weeklyAmt = new Decimal(rule.weeklyRate).mul(weeks);
        items.push({ kind: 'base_rental', description: `${weeks} week${weeks > 1 ? 's' : ''}`, quantity: weeks, unitAmount: new Decimal(rule.weeklyRate), amount: weeklyAmt, taxable: true });
      }
      if (remDays > 0) {
        const dailyAmt = new Decimal(rule.dailyRate).mul(remDays);
        items.push({ kind: 'base_rental', description: `${remDays} day${remDays > 1 ? 's' : ''}`, quantity: remDays, unitAmount: new Decimal(rule.dailyRate), amount: dailyAmt, taxable: true });
      }
    } else {
      const amt = new Decimal(rule.dailyRate).mul(billedDays);
      items.push({ kind: 'base_rental', description: `${billedDays} day${billedDays > 1 ? 's' : ''}`, quantity: billedDays, unitAmount: new Decimal(rule.dailyRate), amount: amt, taxable: true });
    }

    return { days: billedDays, items };
  }

  private async getSettingValue<T>(key: string, fallback: T): Promise<T> {
    const row = await this.prisma.setting.findUnique({ where: { key } });
    if (!row) return fallback;
    return row.value as T;
  }

  // Serialize for JSON snapshot storage
  serializeBreakdown(bd: PriceBreakdown): Record<string, unknown> {
    return {
      currency: bd.currency,
      lineItems: bd.lineItems.map((li) => ({ ...li, unitAmount: li.unitAmount.toFixed(2), amount: li.amount.toFixed(2) })),
      subtotal: bd.subtotal.toFixed(2),
      discountTotal: bd.discountTotal.toFixed(2),
      taxableSubtotal: bd.taxableSubtotal.toFixed(2),
      taxLines: bd.taxLines.map((t) => ({ ...t, rate: t.rate.toFixed(4), taxableAmount: t.taxableAmount.toFixed(2), taxAmount: t.taxAmount.toFixed(2) })),
      taxTotal: bd.taxTotal.toFixed(2),
      total: bd.total.toFixed(2),
      ratePlanId: bd.ratePlanId,
      ratePlanVersion: bd.ratePlanVersion,
      billedDays: bd.billedDays,
      computedAt: bd.computedAt.toISOString(),
    };
  }
}
