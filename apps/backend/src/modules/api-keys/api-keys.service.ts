import { Injectable, NotFoundException } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class ApiKeysService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.apiKey.findMany({
      where: { revokedAt: null },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(name: string, scopes: string[], createdById: string) {
    const raw = `sk_${randomBytes(24).toString('hex')}`;
    const hash = createHash('sha256').update(raw).digest('hex');
    const key = await this.prisma.apiKey.create({
      data: { name, hash, scopes, createdById },
    });
    return { ...key, key: raw };
  }

  async revoke(id: string) {
    const exists = await this.prisma.apiKey.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('API key not found');
    return this.prisma.apiKey.update({ where: { id }, data: { revokedAt: new Date() } });
  }
}
