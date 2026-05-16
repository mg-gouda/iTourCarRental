import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, UseGuards, Req, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import type { Request } from 'express';
import { CarsService } from './cars.service';
import {
  CreateCarDto, UpdateCarDto, TransferCarDto,
  CreateCarCategoryDto, UpdateCarCategoryDto,
} from './dto/create-car.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators';

@Controller('cars')
@UseGuards(AuthGuard, PermissionGuard)
export class CarsController {
  constructor(private readonly carsService: CarsService) {}

  // ── Categories ──────────────────────────────────────────────────────────

  @Get('categories')
  @RequirePermission('cars.view')
  listCategories() {
    return this.carsService.listCategories();
  }

  @Post('categories')
  @RequirePermission('cars.create')
  createCategory(@Body() dto: CreateCarCategoryDto) {
    return this.carsService.createCategory(dto);
  }

  @Patch('categories/:id')
  @RequirePermission('cars.edit')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateCarCategoryDto) {
    return this.carsService.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  @RequirePermission('cars.delete')
  deleteCategory(@Param('id') id: string) {
    return this.carsService.deleteCategory(id);
  }

  // ── Cars ────────────────────────────────────────────────────────────────

  @Get()
  @RequirePermission('cars.view')
  list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('status') status?: string,
    @Query('categoryId') categoryId?: string,
    @Query('branchId') branchId?: string,
    @Query('search') search?: string,
  ) {
    return this.carsService.list({ page, limit, status, categoryId, branchId, search });
  }

  @Get(':id')
  @RequirePermission('cars.view')
  findOne(@Param('id') id: string) {
    return this.carsService.findOne(id);
  }

  @Post()
  @RequirePermission('cars.create')
  create(@Body() dto: CreateCarDto) {
    return this.carsService.create(dto);
  }

  @Patch(':id')
  @RequirePermission('cars.edit')
  update(@Param('id') id: string, @Body() dto: UpdateCarDto) {
    return this.carsService.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('cars.delete')
  delete(@Param('id') id: string) {
    return this.carsService.delete(id);
  }

  @Post(':id/transfer')
  @RequirePermission('cars.transfer')
  transfer(@Param('id') id: string, @Body() dto: TransferCarDto, @Req() req: Request) {
    const user = (req as any).user;
    return this.carsService.transfer(id, dto, user.id);
  }

  @Post(':id/transfers/:transferId/complete')
  @RequirePermission('cars.transfer')
  completeTransfer(@Param('id') id: string, @Param('transferId') transferId: string) {
    return this.carsService.completeTransfer(id, transferId);
  }

  @Post(':id/tags')
  @RequirePermission('cars.edit')
  addTag(@Param('id') id: string, @Body('name') name: string) {
    return this.carsService.addTag(id, name);
  }

  @Delete(':id/tags/:tagId')
  @RequirePermission('cars.edit')
  removeTag(@Param('id') id: string, @Param('tagId') tagId: string) {
    return this.carsService.removeTag(id, tagId);
  }
}
