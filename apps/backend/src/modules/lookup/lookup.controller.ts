import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PrismaService } from '../../common/prisma/prisma.service';

@UseGuards(AuthGuard)
@Controller('lookup')
export class LookupController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('branches')
  async branches(@Query('q') q = '', @Query('limit') limit = 20) {
    return this.prisma.branch.findMany({
      where: {
        deletedAt: null, isActive: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, code: true, city: true },
      take: Math.min(Number(limit), 100),
      orderBy: { name: 'asc' },
    });
  }

  @Get('users')
  async users(@Query('q') q = '', @Query('role') role?: string, @Query('limit') limit = 20) {
    return this.prisma.user.findMany({
      where: {
        deletedAt: null, isActive: true,
        ...(role ? { role: role as any } : {}),
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, fullName: true, email: true, role: true },
      take: Math.min(Number(limit), 100),
      orderBy: { fullName: 'asc' },
    });
  }

  @Get('cars')
  async cars(
    @Query('q') q = '',
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('limit') limit = 20,
  ) {
    return this.prisma.car.findMany({
      where: {
        deletedAt: null,
        ...(status ? { status: status as any } : {}),
        ...(categoryId ? { categoryId } : {}),
        OR: [
          { make: { contains: q, mode: 'insensitive' } },
          { model: { contains: q, mode: 'insensitive' } },
          { licensePlate: { contains: q, mode: 'insensitive' } },
          { vin: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true, make: true, model: true, year: true,
        licensePlate: true, status: true,
        category: { select: { id: true, name: true } },
      },
      take: Math.min(Number(limit), 100),
      orderBy: [{ make: 'asc' }, { model: 'asc' }],
    });
  }

  @Get('customers')
  async customers(@Query('q') q = '', @Query('limit') limit = 20) {
    return this.prisma.customer.findMany({
      where: {
        deletedAt: null,
        OR: [
          { fullName: { contains: q, mode: 'insensitive' } },
          { email: { contains: q, mode: 'insensitive' } },
          { phone: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, fullName: true, email: true, phone: true, flag: true },
      take: Math.min(Number(limit), 100),
      orderBy: { fullName: 'asc' },
    });
  }

  @Get('corporate-accounts')
  async corporateAccounts(@Query('q') q = '', @Query('limit') limit = 20) {
    return this.prisma.corporateAccount.findMany({
      where: {
        deletedAt: null,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { taxNumber: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, taxNumber: true },
      take: Math.min(Number(limit), 100),
      orderBy: { name: 'asc' },
    });
  }

  @Get('car-categories')
  async carCategories(@Query('q') q = '') {
    return this.prisma.carCategory.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      select: { id: true, name: true, description: true },
      orderBy: { sortOrder: 'asc' },
    });
  }

  @Get('tags')
  async tags(@Query('q') q = '', @Query('limit') limit = 20) {
    return this.prisma.tag.findMany({
      where: { name: { contains: q, mode: 'insensitive' } },
      select: { id: true, name: true },
      take: Math.min(Number(limit), 50),
      orderBy: { name: 'asc' },
    });
  }
}
