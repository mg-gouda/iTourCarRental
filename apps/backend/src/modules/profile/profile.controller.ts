import {
  Controller,
  Get,
  Patch,
  Post,
  Delete,
  Body,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { ProfileService } from './profile.service';
import { UpdateProfileDto, ChangePasswordDto, Verify2faDto, Disable2faDto } from './dto/profile.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser } from '../../common/decorators';
import { SessionUserDto } from '@car-rental/shared-types';

@UseGuards(AuthGuard)
@Controller('profile')
export class ProfileController {
  constructor(private readonly profileService: ProfileService) {}

  @Get()
  me(@CurrentUser() user: SessionUserDto) {
    return this.profileService.getProfile(user.id);
  }

  @Patch()
  update(@CurrentUser() user: SessionUserDto, @Body() dto: UpdateProfileDto) {
    return this.profileService.updateProfile(user.id, dto);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  changePassword(@CurrentUser() user: SessionUserDto, @Body() dto: ChangePasswordDto) {
    return this.profileService.changePassword(user.id, dto);
  }

  @Post('2fa/setup')
  setup2fa(@CurrentUser() user: SessionUserDto) {
    return this.profileService.setup2fa(user.id);
  }

  @Post('2fa/verify')
  @HttpCode(HttpStatus.NO_CONTENT)
  verify2fa(@CurrentUser() user: SessionUserDto, @Body() dto: Verify2faDto) {
    return this.profileService.verify2fa(user.id, dto.totpCode);
  }

  @Delete('2fa')
  @HttpCode(HttpStatus.NO_CONTENT)
  disable2fa(@CurrentUser() user: SessionUserDto, @Body() dto: Disable2faDto) {
    return this.profileService.disable2fa(user.id, dto);
  }

  @Post('avatar')
  @UseInterceptors(FileInterceptor('file', { storage: memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } }))
  uploadAvatar(@CurrentUser() user: SessionUserDto, @UploadedFile() file: Express.Multer.File) {
    return this.profileService.uploadAvatar(user.id, file);
  }
}
