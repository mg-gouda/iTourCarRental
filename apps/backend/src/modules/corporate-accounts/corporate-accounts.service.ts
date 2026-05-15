import { Decimal } from '@prisma/client/runtime/library';
import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateCorporateAccountDto, UpdateCorporateAccountDto } from './dto/corporate-account.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class CorporateAccountsService {
  constructor(private prisma: PrismaService) {}

  async list(params: { page: number; limit: number; search?: string }) {
    const { page, limit, search } = params;
    const where = {
      deletedAt: null,
      ...(search && {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { contactName: { contains: search, mode: 'insensitive' as const } },
          { contactEmail: { contains: search, mode: 'insensitive' as const } },
          { taxNumber: { contains: search, mode: 'insensitive' as const } },
        ],
      }),
    };
    const [items, total] = await this.prisma.$transaction([
      this.prisma.corporateAccount.findMany({
        where,
        include: { _count: { select: { customers: { where: { deletedAt: null } } } } },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      this.prisma.corporateAccount.count({ where }),
    ]);
    return { items, total, page, limit, pages: Math.ceil(total / limit) };
  }

  async findOne(id: string) {
    const account = await this.prisma.corporateAccount.findFirst({
      where: { id, deletedAt: null },
      include: {
        customers: { where: { deletedAt: null }, select: { id: true, fullName: true, phone: true, email: true } },
      },
    });
    if (!account) throw new NotFoundException('Corporate account not found');
    return account;
  }

  async create(dto: CreateCorporateAccountDto) {
    return this.prisma.corporateAccount.create({
      data: {
        ...dto,
        creditLimit: dto.creditLimit ? new Decimal(dto.creditLimit) : undefined,
      },
    });
  }

  async update(id: string, dto: UpdateCorporateAccountDto) {
    await this.findOne(id);
    return this.prisma.corporateAccount.update({
      where: { id },
      data: {
        ...dto,
        creditLimit: dto.creditLimit ? new Decimal(dto.creditLimit) : undefined,
      },
    });
  }

  async delete(id: string) {
    await this.findOne(id);
    return this.prisma.corporateAccount.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
