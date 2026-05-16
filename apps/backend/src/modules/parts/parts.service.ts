import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreatePartDto, UpdatePartDto, AdjustStockDto } from './dto/part.dto';

const PART_SELECT = {
  id: true, sku: true, name: true, description: true,
  unitCost: true, currency: true, lowStockThreshold: true,
  stock: { include: { part: false, branch: { select: { id: true, name: true } } } },
};

@Injectable()
export class PartsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: { page?: number; limit?: number; search?: string; lowStock?: boolean }) {
    const { page = 1, limit = 20, search } = query;
    const where: any = {
      ...(search && {
        OR: [
          { sku: { contains: search, mode: 'insensitive' } },
          { name: { contains: search, mode: 'insensitive' } },
        ],
      }),
    };

    const [items, total] = await Promise.all([
      this.prisma.part.findMany({
        where, select: PART_SELECT,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.part.count({ where }),
    ]);

    // Annotate low-stock flag
    const annotated = (items as any[]).map((p) => ({
      ...p,
      totalStock: p.stock.reduce((sum: number, s: any) => sum + s.quantity, 0),
      isLowStock: p.stock.reduce((sum: number, s: any) => sum + s.quantity, 0) <= p.lowStockThreshold,
    }));

    return { items: annotated, total, page, limit };
  }

  async get(id: string) {
    const part = await this.prisma.part.findUnique({ where: { id }, select: PART_SELECT });
    if (!part) throw new NotFoundException('Part not found');
    return part;
  }

  async create(dto: CreatePartDto) {
    const existing = await this.prisma.part.findUnique({ where: { sku: dto.sku } });
    if (existing) throw new BadRequestException(`SKU '${dto.sku}' already exists`);

    return this.prisma.part.create({
      data: {
        sku: dto.sku,
        name: dto.name,
        description: dto.description,
        unitCost: new Decimal(dto.unitCost),
        currency: dto.currency,
        lowStockThreshold: dto.lowStockThreshold ?? 0,
      },
      select: PART_SELECT,
    });
  }

  async update(id: string, dto: UpdatePartDto) {
    await this.get(id);
    return this.prisma.part.update({
      where: { id },
      data: {
        ...(dto.name && { name: dto.name }),
        ...(dto.description !== undefined && { description: dto.description }),
        ...(dto.unitCost && { unitCost: new Decimal(dto.unitCost) }),
        ...(dto.currency && { currency: dto.currency }),
        ...(dto.lowStockThreshold !== undefined && { lowStockThreshold: dto.lowStockThreshold }),
      },
      select: PART_SELECT,
    });
  }

  async adjustStock(id: string, dto: AdjustStockDto) {
    await this.get(id);

    const existing = await this.prisma.partStock.findUnique({
      where: { partId_branchId: { partId: id, branchId: dto.branchId } },
    });

    if (existing) {
      const newQty = existing.quantity + dto.quantity;
      if (newQty < 0) throw new BadRequestException('Stock cannot go below 0');
      return this.prisma.partStock.update({
        where: { partId_branchId: { partId: id, branchId: dto.branchId } },
        data: { quantity: newQty },
        include: { part: { select: { sku: true, name: true } } },
      });
    }

    if (dto.quantity < 0) throw new BadRequestException('Cannot set negative initial stock');
    return this.prisma.partStock.create({
      data: { partId: id, branchId: dto.branchId, quantity: dto.quantity },
      include: { part: { select: { sku: true, name: true } } },
    });
  }

  async delete(id: string) {
    await this.get(id);
    await this.prisma.part.delete({ where: { id } });
  }
}
