import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface CreateWebhookDto {
  name: string;
  url: string;
  secret?: string;
  events: string[];
}

@Injectable()
export class WebhooksService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.webhook.findMany({
      include: { _count: { select: { deliveries: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }

  get(id: string) {
    return this.prisma.webhook.findUniqueOrThrow({ where: { id } });
  }

  deliveries(webhookId: string, page = 1, limit = 20) {
    return Promise.all([
      this.prisma.webhookDelivery.findMany({
        where: { webhookId },
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.webhookDelivery.count({ where: { webhookId } }),
    ]).then(([items, total]) => ({ items, total }));
  }

  create(dto: CreateWebhookDto) {
    return this.prisma.webhook.create({
      data: {
        name: dto.name,
        url: dto.url,
        secret: dto.secret ?? '',
        events: dto.events,
        isActive: true,
      },
    });
  }

  update(id: string, dto: Partial<CreateWebhookDto> & { isActive?: boolean }) {
    return this.prisma.webhook.update({ where: { id }, data: dto });
  }

  async delete(id: string) {
    const exists = await this.prisma.webhook.findUnique({ where: { id } });
    if (!exists) throw new NotFoundException('Webhook not found');
    await this.prisma.webhookDelivery.deleteMany({ where: { webhookId: id } });
    return this.prisma.webhook.delete({ where: { id } });
  }
}
