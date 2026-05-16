import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateMaintenanceDto, UpdateMaintenanceDto } from './dto/maintenance.dto';

const RECORD_SELECT = {
  id: true, kind: true, startedAt: true, completedAt: true,
  mileageAt: true, cost: true, currency: true, description: true,
  createdAt: true, updatedAt: true,
  car: { select: { id: true, make: true, model: true, year: true, licensePlate: true } },
  vendor: { select: { id: true, name: true } },
  partsUsed: { include: { part: { select: { id: true, sku: true, name: true } } } },
};

@Injectable()
export class MaintenanceService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: {
    page?: number; limit?: number; carId?: string; kind?: string;
    vendorId?: string; from?: string; to?: string;
  }) {
    const { page = 1, limit = 20, carId, kind, vendorId, from, to } = query;
    const where: any = {
      deletedAt: null,
      ...(carId && { carId }),
      ...(kind && { kind }),
      ...(vendorId && { vendorId }),
      ...((from || to) && { startedAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
    };
    const [items, total] = await Promise.all([
      this.prisma.maintenanceRecord.findMany({
        where, select: RECORD_SELECT,
        orderBy: { startedAt: 'desc' },
        skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.maintenanceRecord.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async get(id: string) {
    const record = await this.prisma.maintenanceRecord.findFirst({
      where: { id, deletedAt: null }, select: RECORD_SELECT,
    });
    if (!record) throw new NotFoundException('Maintenance record not found');
    return record;
  }

  async create(dto: CreateMaintenanceDto, createdById: string) {
    const car = await this.prisma.car.findFirst({ where: { id: dto.carId, deletedAt: null } });
    if (!car) throw new NotFoundException('Car not found');

    if (car.status === 'RENTED') {
      throw new BadRequestException('Cannot schedule maintenance while car is rented');
    }

    return this.prisma.$transaction(async (tx: any) => {
      const record = await tx.maintenanceRecord.create({
        data: {
          carId: dto.carId,
          kind: dto.kind,
          startedAt: new Date(dto.startedAt),
          completedAt: dto.completedAt ? new Date(dto.completedAt) : undefined,
          mileageAt: dto.mileageAt,
          cost: new Decimal(dto.cost),
          currency: dto.currency,
          description: dto.description,
          vendorId: dto.vendorId,
          mechanicId: dto.mechanicId,
          partsUsed: dto.partsUsed?.length
            ? {
                create: dto.partsUsed.map((p) => ({
                  partId: p.partId,
                  quantity: p.quantity,
                  unitCost: new Decimal(p.unitCost),
                })),
              }
            : undefined,
        },
        select: RECORD_SELECT,
      });

      // Mark car IN_MAINTENANCE if no completedAt
      if (!dto.completedAt) {
        await tx.car.update({ where: { id: dto.carId }, data: { status: 'IN_MAINTENANCE' } });
      }

      // Decrement part stock
      if (dto.partsUsed?.length) {
        for (const p of dto.partsUsed) {
          await tx.partStock.updateMany({
            where: { partId: p.partId },
            data: { quantity: { decrement: p.quantity } },
          });
        }
      }

      return record;
    });
  }

  async complete(id: string, completedAt?: string) {
    const record = await this.get(id);
    if (record.completedAt) throw new BadRequestException('Already completed');

    return this.prisma.$transaction(async (tx: any) => {
      const updated = await tx.maintenanceRecord.update({
        where: { id },
        data: { completedAt: completedAt ? new Date(completedAt) : new Date() },
        select: RECORD_SELECT,
      });
      await tx.car.update({ where: { id: record.car.id }, data: { status: 'AVAILABLE' } });
      return updated;
    });
  }

  async update(id: string, dto: UpdateMaintenanceDto) {
    await this.get(id);
    return this.prisma.maintenanceRecord.update({
      where: { id },
      data: {
        ...(dto.kind && { kind: dto.kind }),
        ...(dto.completedAt && { completedAt: new Date(dto.completedAt) }),
        ...(dto.cost && { cost: new Decimal(dto.cost) }),
        ...(dto.description && { description: dto.description }),
        ...(dto.vendorId !== undefined && { vendorId: dto.vendorId }),
      },
      select: RECORD_SELECT,
    });
  }

  async delete(id: string) {
    await this.get(id);
    await this.prisma.maintenanceRecord.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
