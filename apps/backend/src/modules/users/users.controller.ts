import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  ParseIntPipe,
  DefaultValuePipe,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CurrentUser, RequirePermission } from '../../common/decorators';
import { SessionUserDto, Role } from '@car-rental/shared-types';
import { IsObject, IsOptional, IsString } from 'class-validator';

class UpdateProfileDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  themePreference?: string | null;

  @IsOptional()
  @IsObject()
  notificationPrefs?: Record<string, unknown>;
}

class Setup2faVerifyDto {
  @IsString()
  totpCode!: string;
}

class Disable2faDto {
  @IsString()
  currentPassword!: string;
}

class AdminResetPasswordDto {
  @IsString()
  newPassword!: string;
}

@UseGuards(AuthGuard, PermissionGuard)
@Controller()
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @RequirePermission('users.view')
  @Get('users')
  findAll(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('role') role?: Role,
    @Query('branchId') branchId?: string,
    @Query('isActive') isActive?: string,
  ) {
    const isActiveParsed =
      isActive === 'true' ? true : isActive === 'false' ? false : undefined;

    return this.usersService.findAll({ page, limit, role, branchId, isActive: isActiveParsed });
  }

  @RequirePermission('users.view')
  @Get('users/:id')
  findOne(@Param('id') id: string) {
    return this.usersService.findOne(id);
  }

  @RequirePermission('users.create')
  @Post('users')
  create(@Body() dto: CreateUserDto, @CurrentUser() user: SessionUserDto) {
    return this.usersService.create(dto, user.id);
  }

  @RequirePermission('users.edit')
  @Patch('users/:id')
  update(@Param('id') id: string, @Body() dto: UpdateUserDto) {
    return this.usersService.update(id, dto);
  }

  @RequirePermission('users.delete')
  @Delete('users/:id')
  remove(@Param('id') id: string) {
    return this.usersService.softDelete(id);
  }

  @RequirePermission('users.edit')
  @Post('users/:id/reset-password')
  async resetPassword(
    @Param('id') id: string,
    @Body() dto: AdminResetPasswordDto,
  ) {
    await this.usersService.adminResetPassword(id, dto.newPassword);
    return { message: 'Password reset successfully' };
  }

  // Profile routes (current user)
  @Patch('profile')
  updateProfile(
    @CurrentUser() user: SessionUserDto,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.usersService.updateProfile(user.id, dto);
  }

  @Post('profile/change-password')
  async changePassword(
    @CurrentUser() user: SessionUserDto,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.usersService.changePassword(user.id, dto);
    return { message: 'Password changed successfully' };
  }

  @Post('profile/2fa/setup')
  setup2fa(@CurrentUser() user: SessionUserDto) {
    return this.usersService.setup2fa(user.id);
  }

  @Post('profile/2fa/verify')
  async verify2faSetup(
    @CurrentUser() user: SessionUserDto,
    @Body() dto: Setup2faVerifyDto,
  ) {
    await this.usersService.verify2faSetup(user.id, dto.totpCode);
    return { message: '2FA enabled successfully' };
  }

  @Delete('profile/2fa')
  async disable2fa(
    @CurrentUser() user: SessionUserDto,
    @Body() dto: Disable2faDto,
  ) {
    await this.usersService.disable2fa(user.id, dto.currentPassword);
    return { message: '2FA disabled successfully' };
  }

  @Post('profile/avatar')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAvatar(
    @CurrentUser() user: SessionUserDto,
    @UploadedFile() file: Express.Multer.File,
  ) {
    // Stub: in production, upload to S3 and return the key
    if (!file) {
      return { message: 'No file provided' };
    }

    // Validate MIME type
    const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedMimeTypes.includes(file.mimetype)) {
      return { error: { code: 'INVALID_FILE_TYPE', message: 'Only JPEG, PNG, and WebP images are allowed' } };
    }

    // Stub key — in production this would be the S3 key after upload
    const storageKey = `avatars/${user.id}/${Date.now()}-${file.originalname}`;
    return this.usersService.updateAvatar(user.id, storageKey);
  }
}
