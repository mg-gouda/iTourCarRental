import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PrismaService } from '../prisma/prisma.service';
import { PUBLIC_KEY } from '../decorators';
import { buildEffectivePermissions } from '@car-rental/permissions';
import { SessionUserDto, Role } from '@car-rental/shared-types';
import * as crypto from 'crypto';

function hashCookieValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const sid = request.cookies?.['sid'] as string | undefined;

    if (!sid) {
      throw new UnauthorizedException('No session cookie');
    }

    const cookieHash = hashCookieValue(sid);

    const session = await this.prisma.session.findUnique({
      where: { cookieHash },
      include: {
        user: {
          include: {
            permissionOverrides: true,
          },
        },
      },
    });

    if (!session) {
      throw new UnauthorizedException('Invalid session');
    }

    if (session.revokedAt) {
      throw new UnauthorizedException('Session has been revoked');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session has expired');
    }

    const user = session.user;

    if (!user || !user.isActive || user.deletedAt) {
      throw new UnauthorizedException('User account is inactive or deleted');
    }

    // Build effective permissions
    const overrides = user.permissionOverrides.map((o: any) => ({
      key: o.key,
      effect: o.effect as 'grant' | 'revoke',
    }));

    const effectivePermissions = buildEffectivePermissions({
      role: user.role as Role,
      overrides,
      branchScope: user.branchScope,
    });

    const sessionUser: SessionUserDto = {
      id: user.id,
      email: user.email,
      fullName: user.fullName,
      role: user.role as Role,
      branchScope: user.branchScope,
      isActive: user.isActive,
      twoFactorEnabled: user.twoFactorEnabled,
      avatarUrl: user.avatarKey ? `/api/v1/files/${user.avatarKey}` : undefined,
      language: user.language,
      themePreference: user.themePreference,
      notificationPrefs: user.notificationPrefs as Record<string, unknown>,
      lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
      createdAt: user.createdAt.toISOString(),
      updatedAt: user.updatedAt.toISOString(),
      sessionId: session.id,
      permissions: Array.from(effectivePermissions),
    };

    request.user = sessionUser;

    // Update lastActiveAt asynchronously — don't block the request
    void this.prisma.session.update({
      where: { id: session.id },
      data: { lastActiveAt: new Date() },
    });

    return true;
  }
}
