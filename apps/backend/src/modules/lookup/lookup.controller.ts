import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PrismaService } from '../../common/prisma/prisma.service';

@UseGuards(AuthGuard)
@Controller('lookup')
export class LookupController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('branches')
  async branches(
    @Query('q') q: string = '',
    @Query('limit') limit = 20,
  ) {
    const results = await this.prisma.branch.findMany({
      where: {
        deletedAt: null,
        isActive: true,
        OR: [
          { name: { contains: q, mode: 'insensitive' } },
          { code: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: { id: true, name: true, code: true, city: true },
      take: Math.min(Number(limit), 100),
      orderBy: { name: 'asc' },
    });
    return results;
  }

  @Get('users')
  async users(
    @Query('q') q: string = '',
    @Query('role') role?: string,
    @Query('limit') limit = 20,
  ) {
    const results = await this.prisma.user.findMany({
      where: {
        deletedAt: null,
        isActive: true,
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
    return results;
  }
}
