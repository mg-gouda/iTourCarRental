import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards } from '@nestjs/common';
import { InsuranceService } from './insurance.service';
import { CreateInsurancePolicyDto, UpdateInsurancePolicyDto, CreateInsuranceClaimDto } from './dto/insurance.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators';

@Controller('insurance')
@UseGuards(AuthGuard, PermissionGuard)
export class InsuranceController {
  constructor(private readonly service: InsuranceService) {}

  @Get('policies')
  @RequirePermission('insurance.view')
  listAll(@Query('carId') carId?: string) {
    return this.service.listAll(carId);
  }

  @Get('cars/:carId/policies')
  @RequirePermission('insurance.view')
  listPolicies(@Param('carId') carId: string) {
    return this.service.listPolicies(carId);
  }

  @Get('policies/:id')
  @RequirePermission('insurance.view')
  getPolicy(@Param('id') id: string) {
    return this.service.getPolicy(id);
  }

  @Post('policies')
  @RequirePermission('insurance.create')
  createPolicy(@Body() dto: CreateInsurancePolicyDto) {
    return this.service.createPolicy(dto);
  }

  @Patch('policies/:id')
  @RequirePermission('insurance.edit')
  updatePolicy(@Param('id') id: string, @Body() dto: UpdateInsurancePolicyDto) {
    return this.service.updatePolicy(id, dto);
  }

  @Delete('policies/:id')
  @RequirePermission('insurance.delete')
  deletePolicy(@Param('id') id: string) {
    return this.service.deletePolicy(id);
  }

  @Post('policies/:policyId/claims')
  @RequirePermission('insurance.create')
  createClaim(@Param('policyId') policyId: string, @Body() dto: CreateInsuranceClaimDto) {
    return this.service.createClaim(policyId, dto);
  }
}
