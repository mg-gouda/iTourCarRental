import {
  Body,
  Controller,
  Get,
  Patch,
  UseGuards,
} from '@nestjs/common';
import { StylingService } from './styling.service';
import { UpdateStylingDto } from './dto/update-styling.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { PermissionGuard } from '../../common/guards/permission.guard';
import { CurrentUser, Public, RequirePermission } from '../../common/decorators';
import { SessionUserDto } from '@car-rental/shared-types';

@Controller('styling')
export class StylingController {
  constructor(private readonly stylingService: StylingService) {}

  // Public: frontend needs this to load the theme before auth
  @Public()
  @Get()
  getActive() {
    return this.stylingService.getActive();
  }

  @UseGuards(AuthGuard, PermissionGuard)
  @RequirePermission('system.styling.edit')
  @Patch()
  update(
    @Body() dto: UpdateStylingDto,
    @CurrentUser() user: SessionUserDto,
  ) {
    return this.stylingService.update(dto, user.id);
  }
}
