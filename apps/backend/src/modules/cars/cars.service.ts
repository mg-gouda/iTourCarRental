import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import {
  CreateCarDto, UpdateCarDto, TransferCarDto,
  CreateCarCategoryDto, UpdateCarCategoryDto, CarStatusDto,
} from './dto/create-car.dto';
import { Prisma } from '@prisma/client';

const CAR_SELECT = {
  id: true, make: true, model: true, year: true,
  licensePlate: true, vin: true, transmission: true,
  fuelType: true, seats: true, currentMileage: true,
  status: true, purchaseCost: true, purchasedAt: true,
  registrationExpiry: true, gpsDeviceId: true,
  createdAt: true, updatedAt: true,
  category: { select: { id: true, name: true } },
  homeBranch: { select: { id: true, name: true } },
  _count: { select: { photos: true, bookings: { where: { deletedAt: null } } } },
};

@Injectable()
export class CarsService {
  constructor(private prisma: PrismaService) {}

  // ── Categories ────────────────────────────────────────────────────────────

  async listCategories() {
    return this.prisma.carCategory.findMany({ orderBy: { sortOrder: 'asc' } });
  }

  async createCategory(dto: CreateCarCategoryDto) {
    return this.prisma.carCategory.create({ data: dto });
  }

  async updateCategory(id: string, dto: UpdateCarCategoryDto) {
    await this.findCategoryOrThrow(id);
    return this.prisma.carCategory.update({ where: { id }, data: dto });
  }

  async deleteCategory(id: string) {
    await this.findCategoryOrThrow(id);
    const inUse = await this.prisma.car.count({ where: { categoryId: id, deletedAt: null } });
    if (inUse > 0) throw new ConflictException('Category is in use by active cars');
    return this.prisma.carCategory.delete({ where: { id } });
  }

  private async findCategoryOrThrow(id: string) {
    const cat = await this.prisma.carCategory.findUnique({ where: { id } });
    if (!cat) throw new NotFoundException('Car category not found');
    return cat;
  }

  // ── Cars ──────────────────────────────────────────────────────────────────

  async list(params: {
    page: number; limit: number; status?: string; categoryId?: string;
    branchId?: string; search?: string;
  }) {
    const { page, limit, status, categoryId, branchId, search } = params;
    const where: Prisma.CarWhereInput = {
      deletedAt: null,
      ...(status && { status: status as any }),
      ...(categoryId && { categoryId }),
      ...(branchId && { OR: [{ homeBranchId: branchId }, { currentBranchId: branchId }] }),
      ...(search && {
        OR: [
          { make: { contains: search, mode: 'insensitive' } },
          { model: { contains: search, mode: 'insensitive' } },
          { licensePlate: { contains: search, mode: 'insensitive' } },
          { vin: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.car.findMany({
        where, select: CAR_SELECT,
        skip: (page - 1) * limit, take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.car.count({ where }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const car = await this.prisma.car.findFirst({
      where: { id, deletedAt: null },
      include: {
        category: true,
        homeBranch: { select: { id: true, name: true } },
        photos: { orderBy: { sortOrder: 'asc' } },
        tags: { include: { tag: true } },
        insurancePolicies: { where: { deletedAt: null }, orderBy: { expiryAt: 'desc' } },
        transfers: { orderBy: { initiatedAt: 'desc' }, take: 10 },
      },
    });
    if (!car) throw new NotFoundException('Car not found');
    return car;
  }

  async create(dto: CreateCarDto) {
    await this.checkPlateVin(dto.licensePlate, dto.vin);
    return this.prisma.car.create({
      data: {
        ...dto,
        purchaseCost: dto.purchaseCost ? new Prisma.Decimal(dto.purchaseCost) : undefined,
        purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : undefined,
        registrationExpiry: dto.registrationExpiry ? new Date(dto.registrationExpiry) : undefined,
      },
      select: CAR_SELECT,
    });
  }

  async update(id: string, dto: UpdateCarDto) {
    await this.findOneOrThrow(id);
    if (dto.licensePlate || dto.vin) {
      await this.checkPlateVin(dto.licensePlate, dto.vin, id);
    }
    return this.prisma.car.update({
      where: { id },
      data: {
        ...dto,
        purchaseCost: dto.purchaseCost ? new Prisma.Decimal(dto.purchaseCost) : undefined,
        purchasedAt: dto.purchasedAt ? new Date(dto.purchasedAt) : undefined,
        registrationExpiry: dto.registrationExpiry ? new Date(dto.registrationExpiry) : undefined,
      },
      select: CAR_SELECT,
    });
  }

  async delete(id: string) {
    await this.findOneOrThrow(id);
    const active = await this.prisma.booking.count({
      where: { carId: id, deletedAt: null, status: { in: ['HOLD', 'CONFIRMED', 'CHECKED_OUT'] } },
    });
    if (active > 0) throw new ConflictException('Car has active bookings');
    return this.prisma.car.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async transfer(id: string, dto: TransferCarDto, actorId: string) {
    const car = await this.findOneOrThrow(id);
    if (car.homeBranchId === dto.toBranchId) {
      throw new ConflictException('Car is already at that branch');
    }
    return this.prisma.carTransfer.create({
      data: {
        carId: id,
        fromBranchId: car.currentBranchId ?? car.homeBranchId,
        toBranchId: dto.toBranchId,
        initiatedById: actorId,
        notes: dto.notes,
      },
    });
  }

  async completeTransfer(carId: string, transferId: string) {
    const transfer = await this.prisma.carTransfer.findFirst({
      where: { id: transferId, carId, completedAt: null },
    });
    if (!transfer) throw new NotFoundException('Transfer not found or already completed');
    return this.prisma.$transaction([
      this.prisma.carTransfer.update({
        where: { id: transferId },
        data: { completedAt: new Date() },
      }),
      this.prisma.car.update({
        where: { id: carId },
        data: { currentBranchId: transfer.toBranchId },
      }),
    ]);
  }

  async addTag(carId: string, tagName: string) {
    await this.findOneOrThrow(carId);
    const tag = await this.prisma.tag.upsert({
      where: { name: tagName },
      create: { name: tagName },
      update: {},
    });
    await this.prisma.carTag.upsert({
      where: { carId_tagId: { carId, tagId: tag.id } },
      create: { carId, tagId: tag.id },
      update: {},
    });
    return tag;
  }

  async removeTag(carId: string, tagId: string) {
    await this.prisma.carTag.deleteMany({ where: { carId, tagId } });
  }

  private async findOneOrThrow(id: string) {
    const car = await this.prisma.car.findFirst({ where: { id, deletedAt: null } });
    if (!car) throw new NotFoundException('Car not found');
    return car;
  }

  private async checkPlateVin(plate?: string, vin?: string, excludeId?: string) {
    if (plate) {
      const existing = await this.prisma.car.findFirst({
        where: { licensePlate: plate, deletedAt: null, ...(excludeId && { NOT: { id: excludeId } }) },
      });
      if (existing) throw new ConflictException('License plate already registered');
    }
    if (vin) {
      const existing = await this.prisma.car.findFirst({
        where: { vin, deletedAt: null, ...(excludeId && { NOT: { id: excludeId } }) },
      });
      if (existing) throw new ConflictException('VIN already registered');
    }
  }
}
