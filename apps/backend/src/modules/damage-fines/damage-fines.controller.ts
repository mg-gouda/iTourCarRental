import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { DamageFinesService } from './damage-fines.service';
import {
  CreateDamageDto,
  UpdateDamageDto,
  CreateFineDto,
  UpdateFineDto,
} from './dto/damage-fine.dto';
import { RequirePermission } from '../../common/decorators';

@Controller('damage-fines')
export class DamageFinesController {
  constructor(private readonly svc: DamageFinesService) {}

  // ── Damage ──────────────────────────────────────────────────────────────────

  @Get('damage')
  @RequirePermission('damage_fines.view')
  listDamage(
    @Query('bookingId') bookingId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listDamage({
      bookingId,
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
    });
  }

  @Post('damage')
  @RequirePermission('damage_fines.create')
  createDamage(@Body() dto: CreateDamageDto) {
    return this.svc.createDamage(dto);
  }

  @Patch('damage/:id')
  @RequirePermission('damage_fines.edit')
  updateDamage(@Param('id') id: string, @Body() dto: UpdateDamageDto) {
    return this.svc.updateDamage(id, dto);
  }

  @Delete('damage/:id')
  @RequirePermission('damage_fines.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteDamage(@Param('id') id: string) {
    return this.svc.deleteDamage(id);
  }

  // ── Fines ───────────────────────────────────────────────────────────────────

  @Get('fines')
  @RequirePermission('damage_fines.view')
  listFines(
    @Query('bookingId') bookingId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.svc.listFines({
      bookingId,
      page: page ? +page : 1,
      limit: limit ? +limit : 20,
    });
  }

  @Post('fines')
  @RequirePermission('damage_fines.create')
  createFine(@Body() dto: CreateFineDto) {
    return this.svc.createFine(dto);
  }

  @Patch('fines/:id')
  @RequirePermission('damage_fines.edit')
  updateFine(@Param('id') id: string, @Body() dto: UpdateFineDto) {
    return this.svc.updateFine(id, dto);
  }

  @Delete('fines/:id')
  @RequirePermission('damage_fines.delete')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteFine(@Param('id') id: string) {
    return this.svc.deleteFine(id);
  }
}
