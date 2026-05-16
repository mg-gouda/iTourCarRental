import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

export interface SaveViewDto {
  page: string;
  name: string;
  filters: Record<string, unknown>;
  isDefault?: boolean;
}

@Injectable()
export class SavedViewsService {
  constructor(private readonly prisma: PrismaService) {}

  listForPage(userId: string, page: string) {
    return this.prisma.savedView.findMany({
      where: { userId, page },
      orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }],
    });
  }

  async save(userId: string, dto: SaveViewDto) {
    if (dto.isDefault) {
      await this.prisma.savedView.updateMany({
        where: { userId, page: dto.page, isDefault: true },
        data: { isDefault: false },
      });
    }
    return this.prisma.savedView.create({
      data: { userId, page: dto.page, name: dto.name, filters: dto.filters, isDefault: dto.isDefault ?? false },
    });
  }

  async setDefault(id: string, userId: string) {
    const view = await this.prisma.savedView.findFirstOrThrow({ where: { id, userId } });
    await this.prisma.savedView.updateMany({
      where: { userId, page: view.page },
      data: { isDefault: false },
    });
    return this.prisma.savedView.update({ where: { id }, data: { isDefault: true } });
  }

  delete(id: string, userId: string) {
    return this.prisma.savedView.deleteMany({ where: { id, userId } });
  }
}
