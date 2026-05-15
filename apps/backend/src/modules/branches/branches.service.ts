import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';

@Injectable()
export class BranchesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    page?: number;
    limit?: number;
    isActive?: boolean;
    includeDeleted?: boolean;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.isActive !== undefined) where['isActive'] = query.isActive;
    if (query.includeDeleted) {
      // Override the soft-delete middleware
      where['deletedAt'] = undefined;
    }

    const [branches, total] = await Promise.all([
      this.prisma.branch.findMany({
        where,
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.branch.count({ where }),
    ]);

    return {
      items: branches.map(this.serialize),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string) {
    const branch = await this.prisma.branch.findFirst({ where: { id } });
    if (!branch) throw new NotFoundException('Branch not found');
    return this.serialize(branch);
  }

  async create(dto: CreateBranchDto) {
    const existing = await this.prisma.branch.findUnique({
      where: { code: dto.code },
    });
    if (existing) throw new ConflictException('Branch code already in use');

    const branch = await this.prisma.branch.create({
      data: {
        name: dto.name,
        code: dto.code.toUpperCase(),
        address: dto.address ?? '',
        city: dto.city ?? '',
        country: dto.country ?? '',
        timezone: dto.timezone ?? 'UTC',
        defaultCurrency: dto.defaultCurrency ?? 'USD',
        taxId: dto.taxId ?? null,
        taxRate: dto.taxRate ?? 0,
        taxInclusive: dto.taxInclusive ?? false,
        businessHours: dto.businessHours ?? {},
        holidays: dto.holidays ?? [],
        isActive: dto.isActive ?? true,
      },
    });

    return this.serialize(branch);
  }

  async update(id: string, dto: UpdateBranchDto) {
    const branch = await this.prisma.branch.findFirst({ where: { id } });
    if (!branch) throw new NotFoundException('Branch not found');

    if (dto.code && dto.code !== branch.code) {
      const existing = await this.prisma.branch.findUnique({
        where: { code: dto.code },
      });
      if (existing) throw new ConflictException('Branch code already in use');
    }

    const updated = await this.prisma.branch.update({
      where: { id },
      data: {
        ...(dto.name !== undefined && { name: dto.name }),
        ...(dto.code !== undefined && { code: dto.code.toUpperCase() }),
        ...(dto.address !== undefined && { address: dto.address }),
        ...(dto.city !== undefined && { city: dto.city }),
        ...(dto.country !== undefined && { country: dto.country }),
        ...(dto.timezone !== undefined && { timezone: dto.timezone }),
        ...(dto.defaultCurrency !== undefined && { defaultCurrency: dto.defaultCurrency }),
        ...(dto.taxId !== undefined && { taxId: dto.taxId }),
        ...(dto.taxRate !== undefined && { taxRate: dto.taxRate }),
        ...(dto.taxInclusive !== undefined && { taxInclusive: dto.taxInclusive }),
        ...(dto.businessHours !== undefined && { businessHours: dto.businessHours }),
        ...(dto.holidays !== undefined && { holidays: dto.holidays }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
    });

    return this.serialize(updated);
  }

  async softDelete(id: string): Promise<void> {
    const branch = await this.prisma.branch.findFirst({ where: { id } });
    if (!branch) throw new NotFoundException('Branch not found');

    await this.prisma.branch.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });
  }

  private serialize(branch: {
    id: string;
    name: string;
    code: string;
    address: string;
    city: string;
    country: string;
    timezone: string;
    defaultCurrency: string;
    taxId: string | null;
    taxRate: unknown;
    taxInclusive: boolean;
    businessHours: unknown;
    holidays: unknown;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt: Date | null;
  }) {
    return {
      id: branch.id,
      name: branch.name,
      code: branch.code,
      address: branch.address,
      city: branch.city,
      country: branch.country,
      timezone: branch.timezone,
      defaultCurrency: branch.defaultCurrency,
      taxId: branch.taxId,
      taxRate: branch.taxRate,
      taxInclusive: branch.taxInclusive,
      businessHours: branch.businessHours,
      holidays: branch.holidays,
      isActive: branch.isActive,
      createdAt: branch.createdAt.toISOString(),
      updatedAt: branch.updatedAt.toISOString(),
      deletedAt: branch.deletedAt?.toISOString() ?? null,
    };
  }
}
