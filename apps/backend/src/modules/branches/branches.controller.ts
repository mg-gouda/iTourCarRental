import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { BranchesService } from './branches.service';
import { CreateBranchDto } from './dto/create-branch.dto';
import { UpdateBranchDto } from './dto/update-branch.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { RequirePermission } from '../../common/decorators';

@UseGuards(AuthGuard, PermissionGuard)
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @RequirePermission('branches.view')
  @Get()
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('isActive') isActive?: string,
    @Query('includeDeleted') includeDeleted?: string,
  ) {
    const isActiveParsed =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;

    return this.branchesService.findAll({
      page,
      limit,
      isActive: isActiveParsed,
      includeDeleted: includeDeleted === 'true',
    });
  }

  @RequirePermission('branches.view')
  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.branchesService.findOne(id);
  }

  @RequirePermission('branches.create')
  @Post()
  create(@Body() dto: CreateBranchDto) {
    return this.branchesService.create(dto);
  }

  @RequirePermission('branches.edit')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateBranchDto) {
    return this.branchesService.update(id, dto);
  }

  @RequirePermission('branches.delete')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.branchesService.softDelete(id);
  }
}
