import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { SettingsService } from './settings.service';
import { UpdateSettingDto } from './dto/update-setting.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CurrentUser, RequirePermission } from '../../common/decorators';
import { SessionUserDto } from '@car-rental/shared-types';

@UseGuards(AuthGuard, PermissionGuard)
@Controller('settings')
export class SettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @RequirePermission('system.settings.view')
  @Get()
  findAll() {
    return this.settingsService.findAll();
  }

  @RequirePermission('system.settings.view')
  @Get(':key')
  findOne(@Param('key') key: string) {
    return this.settingsService.findOne(key);
  }

  @RequirePermission('system.settings.edit')
  @Patch(':key')
  update(
    @Param('key') key: string,
    @Body() dto: UpdateSettingDto,
    @CurrentUser() user: SessionUserDto,
  ) {
    return this.settingsService.update(key, dto.value, user.id);
  }
}
