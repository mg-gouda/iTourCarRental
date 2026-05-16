import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';

@Injectable()
export class TagsService {
  constructor(private readonly prisma: PrismaService) {}

  list() {
    return this.prisma.tag.findMany({ orderBy: { name: 'asc' } });
  }

  async create(name: string, color?: string) {
    return this.prisma.tag.create({ data: { name, color } });
  }

  async delete(id: string) {
    const tag = await this.prisma.tag.findUnique({ where: { id } });
    if (!tag) throw new NotFoundException('Tag not found');
    await this.prisma.tag.delete({ where: { id } });
  }

  async assignToCar(carId: string, tagId: string) {
    await this.prisma.carTag.upsert({
      where: { carId_tagId: { carId, tagId } },
      create: { carId, tagId },
      update: {},
    });
  }

  async removeFromCar(carId: string, tagId: string) {
    await this.prisma.carTag.deleteMany({ where: { carId, tagId } });
  }

  async assignToCustomer(customerId: string, tagId: string) {
    await this.prisma.customerTag.upsert({
      where: { customerId_tagId: { customerId, tagId } },
      create: { customerId, tagId },
      update: {},
    });
  }

  async removeFromCustomer(customerId: string, tagId: string) {
    await this.prisma.customerTag.deleteMany({ where: { customerId, tagId } });
  }
}
