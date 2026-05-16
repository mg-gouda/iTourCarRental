import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class FeatureFlagsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.featureFlag.findMany({ orderBy: { key: 'asc' } });
  }

  upsert(key: string, enabled: boolean, rolloutPct: number, roles: string[]) {
    return this.prisma.featureFlag.upsert({
      where: { key },
      create: { key, enabled, rolloutPct, roles: roles as any },
      update: { enabled, rolloutPct, roles: roles as any },
    });
  }

  delete(key: string) {
    return this.prisma.featureFlag.delete({ where: { key } });
  }
}
