import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { AccidentsService } from './accidents.service';
import { CreateAccidentDto, UpdateAccidentDto } from './dto/accident.dto';
import { RequirePermission } from '../../common/decorators';

@Controller('accidents')
export class AccidentsController {
  constructor(private readonly svc: AccidentsService) {}

  @Get()
  @RequirePermission('maintenance.view')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('carId') carId?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
  ) {
    return this.svc.list({ page: page ? +page : 1, limit: limit ? +limit : 20, carId, from, to });
  }

  @Get(':id')
  @RequirePermission('maintenance.view')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post()
  @RequirePermission('maintenance.create')
  create(@Body() dto: CreateAccidentDto, @Req() req: any) {
    const reportedById = req.session?.userId ?? 'system';
    return this.svc.create(dto, reportedById);
  }

  @Patch(':id')
  @RequirePermission('maintenance.create')
  update(@Param('id') id: string, @Body() dto: UpdateAccidentDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('maintenance.create')
  delete(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
