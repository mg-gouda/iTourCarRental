import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { PartsService } from './parts.service';
import { CreatePartDto, UpdatePartDto, AdjustStockDto } from './dto/part.dto';
import { RequirePermission } from '../../common/decorators';

@Controller('parts')
export class PartsController {
  constructor(private readonly svc: PartsService) {}

  @Get()
  @RequirePermission('maintenance.view')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('lowStock') lowStock?: string,
  ) {
    return this.svc.list({
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      search,
      lowStock: lowStock === 'true',
    });
  }

  @Get(':id')
  @RequirePermission('maintenance.view')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post()
  @RequirePermission('maintenance.create')
  create(@Body() dto: CreatePartDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @RequirePermission('maintenance.create')
  update(@Param('id') id: string, @Body() dto: UpdatePartDto) {
    return this.svc.update(id, dto);
  }

  @Post(':id/stock')
  @RequirePermission('maintenance.create')
  adjustStock(@Param('id') id: string, @Body() dto: AdjustStockDto) {
    return this.svc.adjustStock(id, dto);
  }

  @Delete(':id')
  @RequirePermission('maintenance.create')
  delete(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
