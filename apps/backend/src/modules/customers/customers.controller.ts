import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, UseGuards, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto, AdditionalDriverDto, DriverLicenseDto } from './dto/customer.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators';

@Controller('customers')
@UseGuards(AuthGuard, PermissionGuard)
export class CustomersController {
  constructor(private readonly service: CustomersService) {}

  @Get()
  @RequirePermission('customers.view')
  list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('flag') flag?: string,
    @Query('corporateAccountId') corporateAccountId?: string,
  ) {
    return this.service.list({ page, limit, search, flag, corporateAccountId });
  }

  @Get(':id')
  @RequirePermission('customers.view')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission('customers.create')
  create(@Body() dto: CreateCustomerDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermission('customers.edit')
  update(@Param('id') id: string, @Body() dto: UpdateCustomerDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('customers.delete')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  @Post(':id/licenses')
  @RequirePermission('customers.edit')
  addLicense(@Param('id') id: string, @Body() dto: DriverLicenseDto) {
    return this.service.addLicense(id, dto);
  }

  @Delete(':id/licenses/:licenseId')
  @RequirePermission('customers.edit')
  deleteLicense(@Param('id') id: string, @Param('licenseId') licenseId: string) {
    return this.service.deleteLicense(id, licenseId);
  }

  @Post(':id/tags')
  @RequirePermission('customers.edit')
  addTag(@Param('id') id: string, @Body('name') name: string) {
    return this.service.addTag(id, name);
  }

  @Delete(':id/tags/:tagId')
  @RequirePermission('customers.edit')
  removeTag(@Param('id') id: string, @Param('tagId') tagId: string) {
    return this.service.removeTag(id, tagId);
  }
}
