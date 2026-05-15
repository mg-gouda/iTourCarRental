import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class SettingsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Record<string, unknown>> {
    const settings = await this.prisma.setting.findMany({
      orderBy: { key: 'asc' },
    });

    return Object.fromEntries(settings.map((s: any) => [s.key, s.value]));
  }

  async findOne(key: string) {
    const setting = await this.prisma.setting.findUnique({ where: { key } });
    if (!setting) throw new NotFoundException(`Setting '${key}' not found`);
    return { key: setting.key, value: setting.value, updatedAt: setting.updatedAt.toISOString() };
  }

  async update(key: string, value: unknown, actorId: string) {
    const setting = await this.prisma.setting.upsert({
      where: { key },
      update: { value: value as never, updatedById: actorId },
      create: { key, value: value as never, updatedById: actorId },
    });

    return { key: setting.key, value: setting.value, updatedAt: setting.updatedAt.toISOString() };
  }
}
