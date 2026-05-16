import { Decimal } from '@prisma/client/runtime/library';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateRefundDto } from './dto/refund.dto';

/** Default cancellation tiers used when no CancellationPolicy is configured for a branch. */
const DEFAULT_TIERS = [
  { hoursMinimum: 48, refundPercent: 100 },
  { hoursMinimum: 24, refundPercent: 50 },
  { hoursMinimum: 0, refundPercent: 0 },
];

const REFUND_SELECT = {
  id: true,
  bookingId: true,
  paymentId: true,
  invoiceId: true,
  amount: true,
  currency: true,
  reason: true,
  requestedById: true,
  approvedById: true,
  status: true,
  createdAt: true,
  paidAt: true,
  idempotencyKey: true,
};

@Injectable()
export class RefundsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: {
    page?: number;
    limit?: number;
    bookingId?: string;
    status?: string;
    from?: string;
    to?: string;
  }) {
    const { page = 1, limit = 20, bookingId, status, from, to } = query;
    const where: any = {
      ...(bookingId && { bookingId }),
      ...(status && { status }),
      ...(from || to
        ? {
            createdAt: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        select: REFUND_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.refund.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async get(id: string) {
    const refund = await this.prisma.refund.findUnique({
      where: { id },
      select: REFUND_SELECT,
    });
    if (!refund) throw new NotFoundException('Refund not found');
    return refund;
  }

  /**
   * Compute refund amount from the booking's branch cancellation policy.
   * Returns the computed amount and the booking's currency.
   */
  async computeRefundFromCancellation(
    bookingId: string,
  ): Promise<{ amount: Decimal; currency: string }> {
    const booking = await this.prisma.booking.findFirst({
      where: { id: bookingId, deletedAt: null },
      select: { pickupBranchId: true, pickupAt: true, totalAmount: true, currency: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    const hoursUntilPickup =
      (new Date(booking.pickupAt).getTime() - Date.now()) / (1000 * 60 * 60);

    // Load branch cancellation policy
    const policy = await this.prisma.cancellationPolicy.findUnique({
      where: { branchId: booking.pickupBranchId },
    });

    const tiers: Array<{ hoursMinimum: number; refundPercent: number }> =
      policy && Array.isArray((policy.tiers as any))
        ? (policy.tiers as any)
        : DEFAULT_TIERS;

    // Sort descending by hoursMinimum — use first tier that the hours qualify for
    const sorted = [...tiers].sort((a, b) => b.hoursMinimum - a.hoursMinimum);
    const matched = sorted.find((t) => hoursUntilPickup >= t.hoursMinimum) ?? sorted[sorted.length - 1];
    const pct = new Decimal(matched.refundPercent).dividedBy(100);

    return {
      amount: new Decimal(booking.totalAmount).times(pct),
      currency: booking.currency,
    };
  }

  async create(dto: CreateRefundDto, requestedById: string) {
    // Idempotency
    const existing = await this.prisma.refund.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      select: REFUND_SELECT,
    });
    if (existing) return existing;

    // Validate booking
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId, deletedAt: null },
      select: { currency: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    // Resolve amount
    let amount: Decimal;
    let currency: string;

    if (dto.amount !== undefined) {
      amount = new Decimal(dto.amount);
      currency = dto.currency ?? booking.currency;
    } else {
      const computed = await this.computeRefundFromCancellation(dto.bookingId);
      amount = computed.amount;
      currency = dto.currency ?? computed.currency;
    }

    // Two-person rule — read threshold from settings
    let status = 'pending';
    try {
      const setting = await this.prisma.setting.findUnique({
        where: { key: 'two_person_refund_threshold' },
      });
      if (setting) {
        const threshold = setting.value as { amount: number; currency: string };
        // Only auto-approve if same currency and amount is strictly less than threshold
        if (currency === threshold.currency && amount.lessThan(threshold.amount)) {
          status = 'approved';
        }
      } else {
        // No threshold configured — auto-approve
        status = 'approved';
      }
    } catch {
      // Setting not found or invalid — default to requiring manual approval
    }

    return this.prisma.refund.create({
      data: {
        bookingId: dto.bookingId,
        paymentId: dto.paymentId,
        invoiceId: dto.invoiceId,
        amount,
        currency,
        reason: dto.reason,
        requestedById,
        status,
        idempotencyKey: dto.idempotencyKey,
      },
      select: REFUND_SELECT,
    });
  }

  async approve(id: string, approverId: string) {
    const refund = await this.get(id);

    if (['approved', 'paid', 'rejected'].includes(refund.status)) {
      throw new ConflictException(`Refund is already ${refund.status}`);
    }

    // Two-person rule enforcement
    if (approverId === refund.requestedById) {
      throw new ConflictException('Approver must differ from requester');
    }

    return this.prisma.refund.update({
      where: { id },
      data: { status: 'approved', approvedById: approverId },
      select: REFUND_SELECT,
    });
  }

  async reject(id: string, rejectorId: string) {
    const refund = await this.get(id);

    if (['approved', 'paid', 'rejected'].includes(refund.status)) {
      throw new ConflictException(`Refund is already ${refund.status}`);
    }

    return this.prisma.refund.update({
      where: { id },
      data: { status: 'rejected', approvedById: rejectorId },
      select: REFUND_SELECT,
    });
  }

  async markPaid(id: string) {
    const refund = await this.get(id);

    if (refund.status !== 'approved') {
      throw new BadRequestException('Only approved refunds can be marked as paid');
    }

    return this.prisma.refund.update({
      where: { id },
      data: { status: 'paid', paidAt: new Date() },
      select: REFUND_SELECT,
    });
  }
}
