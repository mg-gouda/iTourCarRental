import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateInsurancePolicyDto, UpdateInsurancePolicyDto, CreateInsuranceClaimDto } from './dto/insurance.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class InsuranceService {
  constructor(private prisma: PrismaService) {}

  async listPolicies(carId: string) {
    return this.prisma.insurancePolicy.findMany({
      where: { carId, deletedAt: null },
      include: { claims: true },
      orderBy: { expiryAt: 'desc' },
    });
  }

  async getPolicy(id: string) {
    const policy = await this.prisma.insurancePolicy.findFirst({
      where: { id, deletedAt: null },
      include: { claims: true, car: { select: { id: true, make: true, model: true, licensePlate: true } } },
    });
    if (!policy) throw new NotFoundException('Insurance policy not found');
    return policy;
  }

  async createPolicy(dto: CreateInsurancePolicyDto) {
    return this.prisma.insurancePolicy.create({
      data: {
        ...dto,
        premium: dto.premium ? new Prisma.Decimal(dto.premium) : undefined,
        startAt: new Date(dto.startAt),
        expiryAt: new Date(dto.expiryAt),
      },
    });
  }

  async updatePolicy(id: string, dto: UpdateInsurancePolicyDto) {
    await this.getPolicy(id);
    return this.prisma.insurancePolicy.update({
      where: { id },
      data: {
        ...dto,
        premium: dto.premium ? new Prisma.Decimal(dto.premium) : undefined,
        startAt: dto.startAt ? new Date(dto.startAt) : undefined,
        expiryAt: dto.expiryAt ? new Date(dto.expiryAt) : undefined,
      },
    });
  }

  async deletePolicy(id: string) {
    await this.getPolicy(id);
    return this.prisma.insurancePolicy.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async createClaim(policyId: string, dto: CreateInsuranceClaimDto) {
    await this.getPolicy(policyId);
    return this.prisma.insuranceClaim.create({
      data: {
        policyId,
        ...dto,
        amount: dto.amount ? new Prisma.Decimal(dto.amount) : undefined,
        filedAt: new Date(dto.filedAt),
        resolvedAt: dto.resolvedAt ? new Date(dto.resolvedAt) : undefined,
      },
    });
  }
}
