import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Put,
  UseGuards,
} from '@nestjs/common';
import { PermissionsService } from './permissions.service';
import { SetOverrideDto, UpdateRolePermissionDto } from './dto/set-override.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CurrentUser, RequirePermission } from '../../common/decorators';
import { SessionUserDto } from '@car-rental/shared-types';

@UseGuards(AuthGuard, PermissionGuard)
@Controller('permissions')
export class PermissionsController {
  constructor(private readonly permissionsService: PermissionsService) {}

  @RequirePermission('system.permissions.view')
  @Get('roles')
  getAllRoles() {
    return this.permissionsService.getAllRolesPermissions();
  }

  @RequirePermission('system.permissions.edit')
  @Patch('roles/:role')
  updateRolePermission(
    @Param('role') role: string,
    @Body() dto: UpdateRolePermissionDto,
    @CurrentUser() actor: SessionUserDto,
  ) {
    return this.permissionsService.updateRolePermission(
      role,
      dto.key,
      dto.effect,
      actor.id,
    );
  }

  @RequirePermission('system.permissions.view')
  @Get('users/:userId/overrides')
  getUserOverrides(@Param('userId') userId: string) {
    return this.permissionsService.getUserOverrides(userId);
  }

  @RequirePermission('system.permissions.edit')
  @Put('users/:userId/overrides/:key')
  setUserOverride(
    @Param('userId') userId: string,
    @Param('key') key: string,
    @Body() dto: SetOverrideDto,
    @CurrentUser() actor: SessionUserDto,
  ) {
    return this.permissionsService.setUserOverride(userId, key, dto.effect, actor.id);
  }

  @RequirePermission('system.permissions.edit')
  @Delete('users/:userId/overrides/:key')
  async deleteUserOverride(
    @Param('userId') userId: string,
    @Param('key') key: string,
  ) {
    await this.permissionsService.deleteUserOverride(userId, key);
    return { message: 'Override removed' };
  }

  @RequirePermission('system.permissions.view')
  @Get('users/:userId/effective')
  getUserEffective(@Param('userId') userId: string) {
    return this.permissionsService.getUserEffectivePermissions(userId);
  }
}
