import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class AuditLogService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    page?: number;
    limit?: number;
    actorId?: string;
    action?: string;
    entityType?: string;
    entityId?: string;
    from?: string;
    to?: string;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.actorId) where['actorId'] = query.actorId;
    if (query.action) where['action'] = { contains: query.action, mode: 'insensitive' };
    if (query.entityType) where['entityType'] = query.entityType;
    if (query.entityId) where['entityId'] = query.entityId;

    if (query.from || query.to) {
      where['occurredAt'] = {
        ...(query.from ? { gte: new Date(query.from) } : {}),
        ...(query.to ? { lte: new Date(query.to) } : {}),
      };
    }

    const [entries, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip,
        take: limit,
        orderBy: { occurredAt: 'desc' },
        include: {
          actor: {
            select: { id: true, email: true, fullName: true, role: true },
          },
        },
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      items: entries.map((e: any) => ({
        id: e.id,
        actor: e.actor
          ? {
              id: e.actor.id,
              email: e.actor.email,
              fullName: e.actor.fullName,
              role: e.actor.role,
            }
          : null,
        action: e.action,
        entityType: e.entityType,
        entityId: e.entityId,
        before: e.before,
        after: e.after,
        ip: e.ip,
        userAgent: e.userAgent,
        occurredAt: e.occurredAt.toISOString(),
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
