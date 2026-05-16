import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { MaintenanceService } from './maintenance.service';
import { CreateMaintenanceDto, UpdateMaintenanceDto } from './dto/maintenance.dto';
import { RequirePermission } from '../../common/decorators';

@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly svc: MaintenanceService) {}

  @Get()
  @RequirePermission('maintenance.view')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('carId') carId?: string,
    @Query('kind') kind?: string,
    @Query('vendorId') vendorId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.list({
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      carId, kind, vendorId, from, to,
    });
  }

  @Get(':id')
  @RequirePermission('maintenance.view')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post()
  @RequirePermission('maintenance.create')
  create(@Body() dto: CreateMaintenanceDto, @Param() _: any) {
    // createdById resolved from session in a real impl; use a placeholder for now
    return this.svc.create(dto, 'system');
  }

  @Post(':id/complete')
  @RequirePermission('maintenance.create')
  complete(@Param('id') id: string, @Body() body: { completedAt?: string }) {
    return this.svc.complete(id, body.completedAt);
  }

  @Patch(':id')
  @RequirePermission('maintenance.create')
  update(@Param('id') id: string, @Body() dto: UpdateMaintenanceDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('maintenance.create')
  delete(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
