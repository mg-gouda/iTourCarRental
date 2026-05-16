import { Injectable, NotFoundException } from '@nestjs/common';
import { InputJsonValue } from '@prisma/client/runtime/library';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateAccidentDto, UpdateAccidentDto } from './dto/accident.dto';

const ACCIDENT_SELECT = {
  id: true, occurredAt: true, location: true, policeReportRef: true,
  description: true, thirdPartyDetails: true, insuranceClaimId: true,
  photos: true, createdAt: true,
  car: { select: { id: true, make: true, model: true, year: true, licensePlate: true } },
  booking: { select: { id: true, bookingNumber: true, customer: { select: { id: true, fullName: true } } } },
};

@Injectable()
export class AccidentsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: { page?: number; limit?: number; carId?: string; from?: string; to?: string }) {
    const { page = 1, limit = 20, carId, from, to } = query;
    const where: any = {
      deletedAt: null,
      ...(carId && { carId }),
      ...((from || to) && { occurredAt: { ...(from && { gte: new Date(from) }), ...(to && { lte: new Date(to) }) } }),
    };
    const [items, total] = await Promise.all([
      this.prisma.accidentReport.findMany({
        where, select: ACCIDENT_SELECT,
        orderBy: { occurredAt: 'desc' },
        skip: (page - 1) * limit, take: limit,
      }),
      this.prisma.accidentReport.count({ where }),
    ]);
    return { items, total, page, limit };
  }

  async get(id: string) {
    const report = await this.prisma.accidentReport.findFirst({
      where: { id, deletedAt: null }, select: ACCIDENT_SELECT,
    });
    if (!report) throw new NotFoundException('Accident report not found');
    return report;
  }

  async create(dto: CreateAccidentDto, reportedById: string) {
    return this.prisma.accidentReport.create({
      data: {
        carId: dto.carId,
        bookingId: dto.bookingId,
        occurredAt: new Date(dto.occurredAt),
        location: dto.location,
        policeReportRef: dto.policeReportRef,
        description: dto.description,
        thirdPartyDetails: dto.thirdPartyDetails as InputJsonValue ?? undefined,
        insuranceClaimId: dto.insuranceClaimId,
        reportedById,
      },
      select: ACCIDENT_SELECT,
    });
  }

  async update(id: string, dto: UpdateAccidentDto) {
    await this.get(id);
    return this.prisma.accidentReport.update({
      where: { id },
      data: {
        ...(dto.location !== undefined && { location: dto.location }),
        ...(dto.policeReportRef !== undefined && { policeReportRef: dto.policeReportRef }),
        ...(dto.description && { description: dto.description }),
        ...(dto.thirdPartyDetails !== undefined && { thirdPartyDetails: dto.thirdPartyDetails as InputJsonValue }),
        ...(dto.insuranceClaimId !== undefined && { insuranceClaimId: dto.insuranceClaimId }),
      },
      select: ACCIDENT_SELECT,
    });
  }

  async delete(id: string) {
    await this.get(id);
    await this.prisma.accidentReport.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
