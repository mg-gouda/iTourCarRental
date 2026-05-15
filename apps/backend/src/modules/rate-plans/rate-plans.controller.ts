import { Controller, Get, Post, Patch, Delete, Body, Param, Query, ParseBoolPipe, ParseIntPipe, Optional } from '@nestjs/common';
import { RatePlansService } from './rate-plans.service';
import { CreateRatePlanDto, UpdateRatePlanDto, CreateExtraDto, UpdateExtraDto, UpsertExtraPriceDto, CreateRateRuleDto } from './dto/rate-plan.dto';
import { RequirePermission } from '../../common/decorators';

@Controller('')
export class RatePlansController {
  constructor(private readonly svc: RatePlansService) {}

  // ── Rate Plans ──────────────────────────────────────────────────────────────

  @Get('rate-plans')
  @RequirePermission('system.settings.view')
  listRatePlans(
    @Query('branchId') branchId?: string,
    @Query('active') active?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listRatePlans({
      branchId,
      active: active !== undefined ? active === 'true' : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  @Get('rate-plans/:id')
  @RequirePermission('system.settings.view')
  getRatePlan(@Param('id') id: string) {
    return this.svc.getRatePlan(id);
  }

  @Post('rate-plans')
  @RequirePermission('system.settings.edit')
  createRatePlan(@Body() dto: CreateRatePlanDto) {
    return this.svc.createRatePlan(dto);
  }

  @Patch('rate-plans/:id')
  @RequirePermission('system.settings.edit')
  updateRatePlan(@Param('id') id: string, @Body() dto: UpdateRatePlanDto) {
    return this.svc.updateRatePlan(id, dto);
  }

  @Delete('rate-plans/:id')
  @RequirePermission('system.settings.edit')
  deleteRatePlan(@Param('id') id: string) {
    return this.svc.deleteRatePlan(id);
  }

  // ── Rate Rules ──────────────────────────────────────────────────────────────

  @Post('rate-plans/:id/rules')
  @RequirePermission('system.settings.edit')
  upsertRule(@Param('id') ratePlanId: string, @Body() dto: CreateRateRuleDto) {
    return this.svc.upsertRule(ratePlanId, dto.categoryId, dto);
  }

  @Delete('rate-plans/:id/rules/:categoryId')
  @RequirePermission('system.settings.edit')
  deleteRule(@Param('id') ratePlanId: string, @Param('categoryId') categoryId: string) {
    return this.svc.deleteRule(ratePlanId, categoryId);
  }

  // ── Extras ──────────────────────────────────────────────────────────────────

  @Get('extras')
  @RequirePermission('bookings.create')
  listExtras(@Query('active') active?: string) {
    return this.svc.listExtras(active === 'true');
  }

  @Post('extras')
  @RequirePermission('system.settings.edit')
  createExtra(@Body() dto: CreateExtraDto) {
    return this.svc.createExtra(dto);
  }

  @Patch('extras/:id')
  @RequirePermission('system.settings.edit')
  updateExtra(@Param('id') id: string, @Body() dto: UpdateExtraDto) {
    return this.svc.updateExtra(id, dto);
  }

  @Delete('extras/:id')
  @RequirePermission('system.settings.edit')
  deleteExtra(@Param('id') id: string) {
    return this.svc.deleteExtra(id);
  }

  @Post('rate-plans/:id/extras')
  @RequirePermission('system.settings.edit')
  upsertExtraPrice(@Param('id') ratePlanId: string, @Body() dto: UpsertExtraPriceDto) {
    return this.svc.upsertExtraPrice(ratePlanId, dto);
  }

  @Delete('rate-plans/:id/extras/:extraId')
  @RequirePermission('system.settings.edit')
  deleteExtraPrice(@Param('id') ratePlanId: string, @Param('extraId') extraId: string) {
    return this.svc.deleteExtraPrice(ratePlanId, extraId);
  }
}
