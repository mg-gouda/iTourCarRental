import { Decimal } from '@prisma/client/runtime/library';
import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { Prisma } from '@prisma/client';
import { CreateRatePlanDto, UpdateRatePlanDto, CreateExtraDto, UpdateExtraDto, UpsertExtraPriceDto } from './dto/rate-plan.dto';

@Injectable()
export class RatePlansService {
  constructor(private readonly prisma: PrismaService) {}

  // ── Rate Plans ──────────────────────────────────────────────────────────────

  async listRatePlans(query: { branchId?: string; active?: boolean; page?: number; limit?: number }) {
    const { branchId, active, page = 1, limit = 20 } = query;
    const where: any = {
      ...(branchId && { branchId }),
      ...(active !== undefined && { isActive: active }),
    };
    const [items, total] = await Promise.all([
      this.prisma.ratePlan.findMany({
        where,
        include: { branch: { select: { id: true, name: true } }, rules: { include: { category: true } }, extras: { include: { extra: true } } },
        orderBy: [{ priority: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.ratePlan.count({ where }),
    ]);
    return { items, total, pages: Math.ceil(total / limit) };
  }

  async getRatePlan(id: string) {
    const plan = await this.prisma.ratePlan.findUnique({
      where: { id },
      include: { branch: { select: { id: true, name: true } }, rules: { include: { category: true } }, extras: { include: { extra: true } } },
    });
    if (!plan) throw new NotFoundException('Rate plan not found');
    return plan;
  }

  async createRatePlan(dto: CreateRatePlanDto) {
    const { rules, ...planData } = dto;
    return this.prisma.ratePlan.create({
      data: {
        ...planData,
        startAt: new Date(planData.startAt),
        endAt: new Date(planData.endAt),
        priority: planData.priority ?? 0,
        isActive: planData.isActive ?? true,
        rules: rules
          ? {
              create: rules.map((r) => ({
                categoryId: r.categoryId,
                dailyRate: new Decimal(r.dailyRate),
                weeklyRate: r.weeklyRate != null ? new Decimal(r.weeklyRate) : undefined,
                monthlyRate: r.monthlyRate != null ? new Decimal(r.monthlyRate) : undefined,
                currency: r.currency,
              })),
            }
          : undefined,
      },
      include: { branch: { select: { id: true, name: true } }, rules: { include: { category: true } } },
    });
  }

  async updateRatePlan(id: string, dto: UpdateRatePlanDto) {
    await this.getRatePlan(id);
    return this.prisma.ratePlan.update({
      where: { id },
      data: {
        ...dto,
        ...(dto.startAt && { startAt: new Date(dto.startAt) }),
        ...(dto.endAt && { endAt: new Date(dto.endAt) }),
      },
      include: { branch: { select: { id: true, name: true } }, rules: { include: { category: true } } },
    });
  }

  async deleteRatePlan(id: string) {
    await this.getRatePlan(id);
    await this.prisma.ratePlan.delete({ where: { id } });
  }

  // ── Rate Rules ──────────────────────────────────────────────────────────────

  async upsertRule(ratePlanId: string, categoryId: string, data: { dailyRate: number; weeklyRate?: number; monthlyRate?: number; currency: string }) {
    await this.getRatePlan(ratePlanId);
    return this.prisma.rateRule.upsert({
      where: { ratePlanId_categoryId: { ratePlanId, categoryId } },
      update: {
        dailyRate: new Decimal(data.dailyRate),
        weeklyRate: data.weeklyRate != null ? new Decimal(data.weeklyRate) : undefined,
        monthlyRate: data.monthlyRate != null ? new Decimal(data.monthlyRate) : undefined,
        currency: data.currency,
      },
      create: {
        ratePlanId,
        categoryId,
        dailyRate: new Decimal(data.dailyRate),
        weeklyRate: data.weeklyRate != null ? new Decimal(data.weeklyRate) : undefined,
        monthlyRate: data.monthlyRate != null ? new Decimal(data.monthlyRate) : undefined,
        currency: data.currency,
      },
      include: { category: true },
    });
  }

  async deleteRule(ratePlanId: string, categoryId: string) {
    await this.prisma.rateRule.deleteMany({ where: { ratePlanId, categoryId } });
  }

  // ── Extras ──────────────────────────────────────────────────────────────────

  async listExtras(activeOnly = false) {
    return this.prisma.extra.findMany({
      where: activeOnly ? { isActive: true } : undefined,
      include: { prices: { include: { ratePlan: { select: { id: true, name: true } } } } },
      orderBy: { code: 'asc' },
    });
  }

  async createExtra(dto: CreateExtraDto) {
    const exists = await this.prisma.extra.findUnique({ where: { code: dto.code } });
    if (exists) throw new ConflictException(`Extra code '${dto.code}' already exists`);
    return this.prisma.extra.create({ data: { ...dto, isActive: dto.isActive ?? true } });
  }

  async updateExtra(id: string, dto: UpdateExtraDto) {
    const extra = await this.prisma.extra.findUnique({ where: { id } });
    if (!extra) throw new NotFoundException('Extra not found');
    return this.prisma.extra.update({ where: { id }, data: dto });
  }

  async deleteExtra(id: string) {
    await this.prisma.extra.update({ where: { id }, data: { isActive: false } });
  }

  async upsertExtraPrice(ratePlanId: string, dto: UpsertExtraPriceDto) {
    await this.getRatePlan(ratePlanId);
    return this.prisma.extraPrice.upsert({
      where: { extraId_ratePlanId: { extraId: dto.extraId, ratePlanId } },
      update: { amount: new Decimal(dto.amount), currency: dto.currency },
      create: { extraId: dto.extraId, ratePlanId, amount: new Decimal(dto.amount), currency: dto.currency },
    });
  }

  async deleteExtraPrice(ratePlanId: string, extraId: string) {
    await this.prisma.extraPrice.deleteMany({ where: { ratePlanId, extraId } });
  }
}
