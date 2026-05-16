import { Decimal } from '@prisma/client/runtime/library';
import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreatePaymentDto, VoidPaymentDto } from './dto/payment.dto';

const PAYMENT_SELECT = {
  id: true,
  bookingId: true,
  kind: true,
  method: true,
  amount: true,
  currency: true,
  reference: true,
  recordedById: true,
  recordedAt: true,
  idempotencyKey: true,
  voidedAt: true,
  voidedById: true,
  voidReason: true,
  booking: { select: { id: true, bookingNumber: true, status: true } },
};

@Injectable()
export class PaymentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: {
    page?: number;
    limit?: number;
    bookingId?: string;
    kind?: string;
    from?: string;
    to?: string;
  }) {
    const { page = 1, limit = 20, bookingId, kind, from, to } = query;
    const where: any = {
      ...(bookingId && { bookingId }),
      ...(kind && { kind: kind as any }),
      ...(from || to
        ? {
            recordedAt: {
              ...(from && { gte: new Date(from) }),
              ...(to && { lte: new Date(to) }),
            },
          }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.payment.findMany({
        where,
        select: PAYMENT_SELECT,
        orderBy: { recordedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.payment.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async get(id: string) {
    const payment = await this.prisma.payment.findUnique({
      where: { id },
      select: PAYMENT_SELECT,
    });
    if (!payment) throw new NotFoundException('Payment not found');
    return payment;
  }

  async create(dto: CreatePaymentDto, recordedById: string) {
    // Idempotency check — return existing record if key already used
    const existing = await this.prisma.payment.findUnique({
      where: { idempotencyKey: dto.idempotencyKey },
      select: PAYMENT_SELECT,
    });
    if (existing) return existing;

    // Validate booking exists
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId, deletedAt: null },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    return this.prisma.payment.create({
      data: {
        bookingId: dto.bookingId,
        kind: dto.kind as any,
        method: dto.method as any,
        amount: new Decimal(dto.amount),
        currency: dto.currency,
        reference: dto.reference,
        recordedById,
        idempotencyKey: dto.idempotencyKey,
      },
      select: PAYMENT_SELECT,
    });
  }

  async void(id: string, dto: VoidPaymentDto, userId: string) {
    const payment = await this.get(id);

    if (payment.voidedAt) {
      throw new ConflictException('Payment is already voided');
    }

    return this.prisma.payment.update({
      where: { id },
      data: {
        voidedAt: new Date(),
        voidedById: userId,
        voidReason: dto.reason,
      },
      select: PAYMENT_SELECT,
    });
  }
}
