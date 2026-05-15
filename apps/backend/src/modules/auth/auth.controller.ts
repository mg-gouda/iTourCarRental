import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { Verify2faDto } from './dto/verify-2fa.dto';
import { AuthGuard } from '../../common/guards/auth.guard';
import { CurrentUser, Public } from '../../common/decorators';
import { SessionUserDto } from '@car-rental/shared-types';

const COOKIE_NAME = 'sid';
const COOKIE_OPTIONS_BASE = {
  httpOnly: true,
  sameSite: 'lax' as const,
  path: '/',
};

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip ?? req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const device = req.headers['x-device'] as string | undefined;

    const result = await this.authService.login(dto, ip, userAgent, device);

    if ('requires2fa' in result) {
      return result;
    }

    res.cookie(COOKIE_NAME, result.sid, {
      ...COOKIE_OPTIONS_BASE,
      secure: process.env.NODE_ENV === 'production',
      maxAge: result.cookieMaxAge,
    });

    return result.user;
  }

  @Public()
  @Post('verify-2fa')
  async verify2fa(
    @Body() dto: Verify2faDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const ip = req.ip ?? req.socket?.remoteAddress;
    const userAgent = req.headers['user-agent'];
    const device = req.headers['x-device'] as string | undefined;

    const result = await this.authService.verify2fa(dto, ip, userAgent, device);

    res.cookie(COOKIE_NAME, result.sid, {
      ...COOKIE_OPTIONS_BASE,
      secure: process.env.NODE_ENV === 'production',
      maxAge: result.cookieMaxAge,
    });

    return result.user;
  }

  @UseGuards(AuthGuard)
  @Post('logout')
  async logout(
    @CurrentUser() user: SessionUserDto,
    @Res({ passthrough: true }) res: Response,
  ) {
    await this.authService.logout(user.sessionId);
    res.clearCookie(COOKIE_NAME, { path: '/' });
    return { message: 'Logged out successfully' };
  }

  @UseGuards(AuthGuard)
  @Get('me')
  me(@CurrentUser() user: SessionUserDto) {
    return user;
  }

  @UseGuards(AuthGuard)
  @Get('sessions')
  getSessions(@CurrentUser() user: SessionUserDto) {
    return this.authService.getActiveSessions(user.id, user.sessionId);
  }

  @UseGuards(AuthGuard)
  @Delete('sessions/:id')
  revokeSession(
    @Param('id') sessionId: string,
    @CurrentUser() user: SessionUserDto,
  ) {
    return this.authService.revokeSession(sessionId, user.id);
  }
}
