import { Injectable, NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { PricingService } from './pricing.service';
import { Prisma } from '@prisma/client';
import { CreateBookingDto, UpdateBookingDto, CancelBookingDto, CheckinDto, CheckoutDto, QuoteDto } from './dto/booking.dto';

const BOOKING_SELECT = {
  id: true, bookingNumber: true, status: true, pickupAt: true, returnAt: true,
  actualPickupAt: true, actualReturnAt: true, holdExpiresAt: true,
  fuelPolicy: true, mileageAllowancePerDay: true, expectedKm: true,
  currency: true, totalAmount: true, priceSnapshot: true, licenseSnapshot: true,
  leavesCountry: true, internalNotes: true, visibleNotes: true,
  ratePlanId: true, ratePlanVersion: true,
  createdAt: true, updatedAt: true,
  customer: { select: { id: true, fullName: true, phone: true, email: true, flag: true } },
  car: { select: { id: true, make: true, model: true, year: true, licensePlate: true, category: { select: { name: true } } } },
  pickupBranch: { select: { id: true, name: true, code: true } },
  returnBranch: { select: { id: true, name: true, code: true } },
  extras: { include: { extra: { select: { code: true, name: true } } } },
  modifications: { select: { id: true, kind: true, createdAt: true, newTotal: true } },
  _count: { select: { payments: true, invoices: true } },
};

@Injectable()
export class BookingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly pricing: PricingService,
  ) {}

  // ── Quote ─────────────────────────────────────────────────────────────────

  async quote(dto: QuoteDto) {
    const breakdown = await this.pricing.quote({
      carId: dto.carId,
      pickupBranchId: dto.pickupBranchId,
      returnBranchId: dto.returnBranchId,
      pickupAt: new Date(dto.pickupAt),
      returnAt: new Date(dto.returnAt),
      driverAge: dto.driverAge ?? 30,
      additionalDrivers: [],
      extras: dto.extras ?? [],
      fuelPolicy: (dto.fuelPolicy ?? 'FULL_TO_FULL') as any,
      mileageAllowancePerDay: dto.mileageAllowancePerDay ?? null,
      promoCode: dto.promoCode,
      corporateAccountId: dto.corporateAccountId,
      referenceTime: new Date(),
    });
    return this.pricing.serializeBreakdown(breakdown);
  }

  // ── List ──────────────────────────────────────────────────────────────────

  async list(query: {
    page?: number; limit?: number; search?: string;
    status?: string; carId?: string; customerId?: string; branchId?: string;
    from?: string; to?: string;
  }) {
    const { page = 1, limit = 20, search, status, carId, customerId, branchId, from, to } = query;
    const where: Prisma.BookingWhereInput = {
      deletedAt: null,
      ...(status && { status: status as any }),
      ...(carId && { carId }),
      ...(customerId && { customerId }),
      ...(branchId && { OR: [{ pickupBranchId: branchId }, { returnBranchId: branchId }] }),
      ...(from && { pickupAt: { gte: new Date(from) } }),
      ...(to && { returnAt: { lte: new Date(to) } }),
      ...(search && {
        OR: [
          { bookingNumber: { contains: search, mode: 'insensitive' } },
          { customer: { fullName: { contains: search, mode: 'insensitive' } } },
          { customer: { phone: { contains: search, mode: 'insensitive' } } },
          { car: { licensePlate: { contains: search, mode: 'insensitive' } } },
        ],
      }),
    };
    const [items, total] = await Promise.all([
      this.prisma.booking.findMany({ where, select: BOOKING_SELECT, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit }),
      this.prisma.booking.count({ where }),
    ]);
    return { items, total, pages: Math.ceil(total / limit) };
  }

  async get(id: string) {
    const booking = await this.prisma.booking.findFirst({ where: { id, deletedAt: null }, select: BOOKING_SELECT });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  // ── Create (HOLD) ─────────────────────────────────────────────────────────

  async create(dto: CreateBookingDto, createdById: string) {
    const customer = await this.prisma.customer.findFirst({ where: { id: dto.customerId, deletedAt: null } });
    if (!customer) throw new NotFoundException('Customer not found');
    if (customer.flag === 'BLACKLISTED') throw new BadRequestException('Customer is blacklisted');

    const car = await this.prisma.car.findFirst({ where: { id: dto.carId, deletedAt: null } });
    if (!car) throw new NotFoundException('Car not found');
    if (car.status !== 'AVAILABLE') throw new BadRequestException(`Car is not available (status: ${car.status})`);

    const pickupAt = new Date(dto.pickupAt);
    const returnAt = new Date(dto.returnAt);
    if (returnAt <= pickupAt) throw new BadRequestException('Return date must be after pickup date');

    // Run pricing engine
    const breakdown = await this.pricing.quote({
      carId: dto.carId,
      pickupBranchId: dto.pickupBranchId,
      returnBranchId: dto.returnBranchId,
      pickupAt, returnAt,
      driverAge: dto.driverAge ?? 30,
      additionalDrivers: [],
      extras: dto.extras ?? [],
      fuelPolicy: dto.fuelPolicy as any,
      mileageAllowancePerDay: dto.mileageAllowancePerDay ?? null,
      promoCode: dto.promoCode,
      corporateAccountId: dto.corporateAccountId,
      referenceTime: new Date(),
    });

    // License snapshot
    const primaryLicense = await this.prisma.driverLicense.findFirst({
      where: { customerId: dto.customerId },
      orderBy: { createdAt: 'asc' },
    });
    const licenseSnapshot = primaryLicense
      ? { number: primaryLicense.number, expiryAt: primaryLicense.expiryAt, country: primaryLicense.country }
      : {};

    // Booking number: branch-prefix + date + random
    const branch = await this.prisma.branch.findUniqueOrThrow({ where: { id: dto.pickupBranchId }, select: { code: true } });
    const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
    const bookingNumber = `${branch.code}-${datePart}-${rand}`;

    // Look up promo code id
    let promoCodeId: string | undefined;
    if (dto.promoCode) {
      const promo = await this.prisma.promoCode.findFirst({ where: { code: dto.promoCode, isActive: true } });
      if (promo) promoCodeId = promo.id;
    }

    const booking = await this.prisma.booking.create({
      data: {
        bookingNumber,
        customerId: dto.customerId,
        corporateAccountId: dto.corporateAccountId,
        carId: dto.carId,
        pickupBranchId: dto.pickupBranchId,
        returnBranchId: dto.returnBranchId,
        pickupAt,
        returnAt,
        status: 'HOLD',
        holdExpiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 min hold
        fuelPolicy: dto.fuelPolicy as any,
        mileageAllowancePerDay: dto.mileageAllowancePerDay,
        expectedKm: dto.expectedKm,
        promoCodeId,
        ratePlanId: breakdown.ratePlanId,
        ratePlanVersion: breakdown.ratePlanVersion,
        priceSnapshot: this.pricing.serializeBreakdown(breakdown) as Prisma.InputJsonValue,
        currency: breakdown.currency,
        totalAmount: breakdown.total,
        licenseSnapshot: licenseSnapshot as Prisma.InputJsonValue,
        leavesCountry: dto.leavesCountry ?? false,
        internalNotes: dto.internalNotes,
        visibleNotes: dto.visibleNotes,
        createdById,
        extras: dto.extras
          ? {
              create: dto.extras.map((e) => ({
                extraId: e.extraId,
                quantity: e.quantity,
                unitAmount: new Prisma.Decimal(0), // filled from breakdown
                currency: breakdown.currency,
              })),
            }
          : undefined,
      },
      select: BOOKING_SELECT,
    });

    return booking;
  }

  // ── Confirm HOLD → CONFIRMED ──────────────────────────────────────────────

  async confirm(id: string, userId: string) {
    const booking = await this.get(id);
    if (booking.status !== 'HOLD' && booking.status !== 'PENDING') {
      throw new BadRequestException(`Cannot confirm booking in status ${booking.status}`);
    }
    return this.prisma.booking.update({
      where: { id },
      data: { status: 'CONFIRMED', holdExpiresAt: null, updatedById: userId },
      select: BOOKING_SELECT,
    });
  }

  // ── Cancel ────────────────────────────────────────────────────────────────

  async cancel(id: string, dto: CancelBookingDto, userId: string) {
    const booking = await this.get(id);
    const cancellable: string[] = ['HOLD', 'PENDING', 'CONFIRMED'];
    if (!cancellable.includes(booking.status)) {
      throw new BadRequestException(`Cannot cancel booking in status ${booking.status}`);
    }
    return this.prisma.booking.update({
      where: { id },
      data: { status: 'CANCELLED', internalNotes: dto.reason ? `${booking.internalNotes ?? ''}\nCancelled: ${dto.reason}`.trim() : booking.internalNotes, updatedById: userId },
      select: BOOKING_SELECT,
    });
  }

  // ── Check-in: CONFIRMED → ACTIVE ─────────────────────────────────────────

  async checkin(id: string, dto: CheckinDto, userId: string) {
    const booking = await this.get(id);
    if (booking.status !== 'CONFIRMED') throw new BadRequestException('Booking must be CONFIRMED to check in');

    return this.prisma.$transaction(async (tx) => {
      await tx.inspection.create({
        data: {
          bookingId: id,
          kind: 'PICKUP',
          performedById: userId,
          mileage: dto.mileage,
          fuelLevel: dto.fuelLevel,
          exteriorDamage: (dto.exteriorDamage as any) ?? {},
          interiorCondition: dto.interiorCondition,
        },
      });
      await tx.car.update({ where: { id: booking.car.id }, data: { status: 'RENTED', currentMileage: dto.mileage } });
      return tx.booking.update({
        where: { id },
        data: { status: 'ACTIVE', actualPickupAt: new Date(), updatedById: userId },
        select: BOOKING_SELECT,
      });
    });
  }

  // ── Check-out: ACTIVE → COMPLETED ────────────────────────────────────────

  async checkout(id: string, dto: CheckoutDto, userId: string) {
    const booking = await this.get(id);
    if (booking.status !== 'ACTIVE') throw new BadRequestException('Booking must be ACTIVE to check out');

    const actualReturnAt = new Date();
    // Recompute pricing with actuals for final invoice
    const originalSnapshot = booking.priceSnapshot as any;
    const finalBreakdown = await this.pricing.quote({
      carId: booking.car.id,
      pickupBranchId: booking.pickupBranch.id,
      returnBranchId: booking.returnBranch.id,
      pickupAt: new Date(booking.pickupAt),
      returnAt: new Date(booking.returnAt),
      driverAge: 30,
      additionalDrivers: [],
      extras: booking.extras.map((e) => ({ extraId: e.extraId, quantity: e.quantity })),
      fuelPolicy: booking.fuelPolicy as any,
      mileageAllowancePerDay: booking.mileageAllowancePerDay,
      referenceTime: actualReturnAt,
      actualReturnAt,
      actualKm: dto.mileage - ((await this.prisma.inspection.findFirst({ where: { bookingId: id, kind: 'PICKUP' }, orderBy: { performedAt: 'desc' } }))?.mileage ?? dto.mileage),
      actualFuelLevel: dto.fuelLevel,
    });

    return this.prisma.$transaction(async (tx) => {
      await tx.inspection.create({
        data: {
          bookingId: id,
          kind: 'RETURN',
          performedById: userId,
          mileage: dto.mileage,
          fuelLevel: dto.fuelLevel,
          exteriorDamage: (dto.exteriorDamage as any) ?? {},
          interiorCondition: dto.interiorCondition,
        },
      });
      await tx.car.update({ where: { id: booking.car.id }, data: { status: 'AVAILABLE', currentMileage: dto.mileage } });
      return tx.booking.update({
        where: { id },
        data: {
          status: 'COMPLETED',
          actualReturnAt,
          totalAmount: finalBreakdown.total,
          priceSnapshot: this.pricing.serializeBreakdown(finalBreakdown) as Prisma.InputJsonValue,
          updatedById: userId,
        },
        select: BOOKING_SELECT,
      });
    });
  }

  // ── Update ────────────────────────────────────────────────────────────────

  async update(id: string, dto: UpdateBookingDto, userId: string) {
    await this.get(id);
    return this.prisma.booking.update({
      where: { id },
      data: {
        ...(dto.pickupAt && { pickupAt: new Date(dto.pickupAt) }),
        ...(dto.returnAt && { returnAt: new Date(dto.returnAt) }),
        ...(dto.returnBranchId && { returnBranchId: dto.returnBranchId }),
        ...(dto.fuelPolicy && { fuelPolicy: dto.fuelPolicy as any }),
        ...(dto.mileageAllowancePerDay !== undefined && { mileageAllowancePerDay: dto.mileageAllowancePerDay }),
        ...(dto.internalNotes !== undefined && { internalNotes: dto.internalNotes }),
        ...(dto.visibleNotes !== undefined && { visibleNotes: dto.visibleNotes }),
        updatedById: userId,
      },
      select: BOOKING_SELECT,
    });
  }

  // ── Delete (soft) ─────────────────────────────────────────────────────────

  async delete(id: string) {
    const booking = await this.get(id);
    if (!['CANCELLED', 'COMPLETED', 'NO_SHOW'].includes(booking.status)) {
      throw new BadRequestException('Only cancelled or completed bookings can be deleted');
    }
    await this.prisma.booking.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  // ── Calendar data ─────────────────────────────────────────────────────────

  async calendar(from: string, to: string, branchId?: string) {
    const bookings = await this.prisma.booking.findMany({
      where: {
        deletedAt: null,
        status: { in: ['HOLD', 'CONFIRMED', 'ACTIVE', 'OVERDUE'] },
        pickupAt: { lte: new Date(to) },
        returnAt: { gte: new Date(from) },
        ...(branchId && { OR: [{ pickupBranchId: branchId }, { returnBranchId: branchId }] }),
      },
      select: {
        id: true, bookingNumber: true, status: true, pickupAt: true, returnAt: true,
        customer: { select: { fullName: true } },
        car: { select: { id: true, make: true, model: true, licensePlate: true } },
      },
      orderBy: { pickupAt: 'asc' },
    });
    return bookings;
  }
}
