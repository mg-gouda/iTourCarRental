import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { VendorsService } from './vendors.service';
import { CreateVendorDto, UpdateVendorDto } from './dto/vendor.dto';
import { RequirePermission } from '../../common/decorators';

@Controller('maintenance/vendors')
export class VendorsController {
  constructor(private readonly svc: VendorsService) {}

  @Get()
  @RequirePermission('maintenance.view')
  list(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('active') active?: string,
  ) {
    return this.svc.list({
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
      search,
      active: active !== undefined ? active === 'true' : undefined,
    });
  }

  @Get(':id')
  @RequirePermission('maintenance.view')
  get(@Param('id') id: string) {
    return this.svc.get(id);
  }

  @Post()
  @RequirePermission('maintenance.create')
  create(@Body() dto: CreateVendorDto) {
    return this.svc.create(dto);
  }

  @Patch(':id')
  @RequirePermission('maintenance.create')
  update(@Param('id') id: string, @Body() dto: UpdateVendorDto) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('maintenance.create')
  delete(@Param('id') id: string) {
    return this.svc.delete(id);
  }
}
