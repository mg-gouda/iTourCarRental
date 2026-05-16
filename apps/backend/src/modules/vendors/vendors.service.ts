import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateVendorDto, UpdateVendorDto } from './dto/vendor.dto';

const VENDOR_SELECT = {
  id: true, name: true, contact: true, phone: true,
  specialty: true, warrantyTerms: true, isActive: true, createdAt: true,
  _count: { select: { maintenance: true } },
};

@Injectable()
export class VendorsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: { page?: number; limit?: number; search?: string; active?: boolean }) {
    const { page = 1, limit = 20, search, active } = query;
    const where: any = {
      deletedAt: null,
      ...(active !== undefined && { isActive: active }),
      ...(search && { name: { contains: search, mode: 'insensitive' } }),
    };
    const [items, total] = await Promise.all([
      this.prisma.maintenanceVendor.findMany({
        where, select: VENDOR_SELECT,
        orderBy: { name: 'asc' },
        skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.maintenanceVendor.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async get(id: string) {
    const vendor = await this.prisma.maintenanceVendor.findFirst({
      where: { id, deletedAt: null }, select: VENDOR_SELECT,
    });
    if (!vendor) throw new NotFoundException('Vendor not found');
    return vendor;
  }

  async create(dto: CreateVendorDto) {
    return this.prisma.maintenanceVendor.create({ data: dto, select: VENDOR_SELECT });
  }

  async update(id: string, dto: UpdateVendorDto) {
    await this.get(id);
    return this.prisma.maintenanceVendor.update({
      where: { id }, data: dto, select: VENDOR_SELECT,
    });
  }

  async delete(id: string) {
    await this.get(id);
    await this.prisma.maintenanceVendor.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
