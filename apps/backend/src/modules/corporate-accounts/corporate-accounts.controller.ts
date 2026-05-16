import {
  Controller, Get, Post, Patch, Delete, Body, Param,
  Query, UseGuards, ParseIntPipe, DefaultValuePipe,
} from '@nestjs/common';
import { CorporateAccountsService } from './corporate-accounts.service';
import { CreateCorporateAccountDto, UpdateCorporateAccountDto } from './dto/corporate-account.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators';

@Controller('corporate-accounts')
@UseGuards(AuthGuard, PermissionGuard)
export class CorporateAccountsController {
  constructor(private readonly service: CorporateAccountsService) {}

  @Get()
  @RequirePermission('corporate_accounts.view')
  list(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
  ) {
    return this.service.list({ page, limit, search });
  }

  @Get(':id')
  @RequirePermission('corporate_accounts.view')
  findOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @RequirePermission('corporate_accounts.create')
  create(@Body() dto: CreateCorporateAccountDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @RequirePermission('corporate_accounts.edit')
  update(@Param('id') id: string, @Body() dto: UpdateCorporateAccountDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @RequirePermission('corporate_accounts.delete')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }
}
