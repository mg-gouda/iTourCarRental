import { Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { TagsService } from './tags.service';
import { RequirePermission } from '../../common/decorators';

@Controller('tags')
export class TagsController {
  constructor(private readonly svc: TagsService) {}

  @Get()
  list() { return this.svc.list(); }

  @Post()
  @RequirePermission('settings.edit')
  create(@Body() dto: { name: string; color?: string }) {
    return this.svc.create(dto.name, dto.color);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('settings.edit')
  delete(@Param('id') id: string) { return this.svc.delete(id); }

  @Post('cars/:carId')
  @RequirePermission('cars.edit')
  assignToCar(@Param('carId') carId: string, @Body('tagId') tagId: string) {
    return this.svc.assignToCar(carId, tagId);
  }

  @Delete('cars/:carId/:tagId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('cars.edit')
  removeFromCar(@Param('carId') carId: string, @Param('tagId') tagId: string) {
    return this.svc.removeFromCar(carId, tagId);
  }

  @Post('customers/:customerId')
  @RequirePermission('customers.edit')
  assignToCustomer(@Param('customerId') customerId: string, @Body('tagId') tagId: string) {
    return this.svc.assignToCustomer(customerId, tagId);
  }

  @Delete('customers/:customerId/:tagId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @RequirePermission('customers.edit')
  removeFromCustomer(@Param('customerId') customerId: string, @Param('tagId') tagId: string) {
    return this.svc.removeFromCustomer(customerId, tagId);
  }
}
