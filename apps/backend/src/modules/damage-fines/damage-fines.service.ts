import { Decimal } from '@prisma/client/runtime/library';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import {
  CreateDamageDto,
  UpdateDamageDto,
  CreateFineDto,
  UpdateFineDto,
} from './dto/damage-fine.dto';

// ── Damage ────────────────────────────────────────────────────────────────────

const DAMAGE_SELECT = {
  id: true,
  bookingId: true,
  inspectionId: true,
  description: true,
  estimatedCost: true,
  currency: true,
  invoicedItemId: true,
  createdAt: true,
  booking: { select: { id: true, bookingNumber: true } },
};

// ── Fines ─────────────────────────────────────────────────────────────────────

const FINE_SELECT = {
  id: true,
  bookingId: true,
  kind: true,
  externalRef: true,
  occurredAt: true,
  amount: true,
  currency: true,
  serviceFee: true,
  invoicedItemId: true,
  notes: true,
  createdAt: true,
  booking: { select: { id: true, bookingNumber: true } },
};

@Injectable()
export class DamageFinesService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Damage CRUD ─────────────────────────────────────────────────────────────

  async listDamage(query: { bookingId?: string; page?: number; limit?: number }) {
    const { bookingId, page = 1, limit = 20 } = query;
    const where: any = {
      ...(bookingId && { bookingId }),
    };

    const [items, total] = await Promise.all([
      this.prisma.damageRecord.findMany({
        where,
        select: DAMAGE_SELECT,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.damageRecord.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getDamage(id: string) {
    const record = await this.prisma.damageRecord.findUnique({
      where: { id },
      select: DAMAGE_SELECT,
    });
    if (!record) throw new NotFoundException('Damage record not found');
    return record;
  }

  async createDamage(dto: CreateDamageDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId, deletedAt: null },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    return this.prisma.damageRecord.create({
      data: {
        bookingId: dto.bookingId,
        description: dto.description,
        estimatedCost: new Decimal(dto.estimatedCost),
        currency: dto.currency,
        inspectionId: dto.inspectionId,
      },
      select: DAMAGE_SELECT,
    });
  }

  async updateDamage(id: string, dto: UpdateDamageDto) {
    await this.getDamage(id);

    return this.prisma.damageRecord.update({
      where: { id },
      data: {
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.estimatedCost !== undefined && {
          estimatedCost: new Decimal(dto.estimatedCost),
        }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.inspectionId !== undefined && { inspectionId: dto.inspectionId }),
      },
      select: DAMAGE_SELECT,
    });
  }

  async deleteDamage(id: string) {
    await this.getDamage(id);
    await this.prisma.damageRecord.delete({ where: { id } });
  }

  // ── Fine CRUD ───────────────────────────────────────────────────────────────

  async listFines(query: { bookingId?: string; page?: number; limit?: number }) {
    const { bookingId, page = 1, limit = 20 } = query;
    const where: any = {
      ...(bookingId && { bookingId }),
    };

    const [items, total] = await Promise.all([
      this.prisma.fine.findMany({
        where,
        select: FINE_SELECT,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.fine.count({ where }),
    ]);

    return { items, total, page, limit };
  }

  async getFine(id: string) {
    const fine = await this.prisma.fine.findUnique({
      where: { id },
      select: FINE_SELECT,
    });
    if (!fine) throw new NotFoundException('Fine not found');
    return fine;
  }

  async createFine(dto: CreateFineDto) {
    const booking = await this.prisma.booking.findFirst({
      where: { id: dto.bookingId, deletedAt: null },
    });
    if (!booking) throw new NotFoundException('Booking not found');

    return this.prisma.fine.create({
      data: {
        bookingId: dto.bookingId,
        kind: dto.kind,
        amount: new Decimal(dto.amount),
        currency: dto.currency,
        occurredAt: new Date(dto.occurredAt),
        externalRef: dto.externalRef,
        serviceFee: dto.serviceFee !== undefined ? new Decimal(dto.serviceFee) : undefined,
        notes: dto.notes,
      },
      select: FINE_SELECT,
    });
  }

  async updateFine(id: string, dto: UpdateFineDto) {
    await this.getFine(id);

    return this.prisma.fine.update({
      where: { id },
      data: {
        ...(dto.kind !== undefined && { kind: dto.kind }),
        ...(dto.amount !== undefined && { amount: new Decimal(dto.amount) }),
        ...(dto.currency !== undefined && { currency: dto.currency }),
        ...(dto.occurredAt !== undefined && { occurredAt: new Date(dto.occurredAt) }),
        ...(dto.externalRef !== undefined && { externalRef: dto.externalRef }),
        ...(dto.serviceFee !== undefined && {
          serviceFee: new Decimal(dto.serviceFee),
        }),
        ...(dto.notes !== undefined && { notes: dto.notes }),
      },
      select: FINE_SELECT,
    });
  }

  async deleteFine(id: string) {
    await this.getFine(id);
    await this.prisma.fine.delete({ where: { id } });
  }
}
