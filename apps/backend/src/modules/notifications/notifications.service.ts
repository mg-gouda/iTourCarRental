import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface NotifyDto {
  userId: string;
  kind: string;
  payload: Record<string, unknown>;
  channel?: 'IN_APP' | 'EMAIL' | 'BOTH';
}

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async notify(dto: NotifyDto) {
    const channel = dto.channel ?? 'IN_APP';
    if (channel === 'EMAIL') return;

    return this.prisma.notification.create({
      data: {
        userId: dto.userId,
        kind: dto.kind,
        payload: dto.payload,
        channel: channel === 'BOTH' ? 'EMAIL' : 'IN_APP',
        sentAt: new Date(),
      },
    });
  }

  async list(userId: string, unreadOnly = false) {
    return this.prisma.notification.findMany({
      where: { userId, ...(unreadOnly ? { readAt: null } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  async countUnread(userId: string) {
    return this.prisma.notification.count({ where: { userId, readAt: null } });
  }

  async markRead(id: string, userId: string) {
    return this.prisma.notification.updateMany({
      where: { id, userId },
      data: { readAt: new Date() },
    });
  }

  async markAllRead(userId: string) {
    return this.prisma.notification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
  }

  async delete(id: string, userId: string) {
    return this.prisma.notification.deleteMany({ where: { id, userId } });
  }
}
