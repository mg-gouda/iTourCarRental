import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { LoginDto } from './dto/login.dto';
import { Verify2faDto } from './dto/verify-2fa.dto';
import { buildEffectivePermissions } from '@car-rental/permissions';
import { SessionUserDto, Role } from '@car-rental/shared-types';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';

const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutes
const SESSION_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

// In-memory challenge store for 2FA (keyed by challengeToken -> { userId, expiresAt })
// In production, this should be backed by Redis/DB
const challengeStore = new Map<string, { userId: string; expiresAt: Date }>();

function hashCookieValue(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

function buildSessionUser(
  user: {
    id: string;
    email: string;
    fullName: string;
    role: string;
    branchScope: string[];
    isActive: boolean;
    twoFactorEnabled: boolean;
    avatarKey: string | null;
    language: string;
    themePreference: string | null;
    notificationPrefs: unknown;
    lastLoginAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  },
  sessionId: string,
  overrides: Array<{ key: string; effect: 'grant' | 'revoke' }>,
): SessionUserDto {
  const effectivePermissions = buildEffectivePermissions({
    role: user.role as Role,
    overrides,
    branchScope: user.branchScope,
  });

  return {
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
    sessionId,
    permissions: Array.from(effectivePermissions),
  };
}

@Injectable()
export class AuthService {
  constructor(private readonly prisma: PrismaService) {}

  async login(
    dto: LoginDto,
    ip?: string,
    userAgent?: string,
    device?: string,
  ): Promise<
    | { requires2fa: true; challengeToken: string }
    | { user: SessionUserDto; sid: string; cookieMaxAge: number }
  > {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      include: { permissionOverrides: true },
    });

    if (!user || !user.isActive || user.deletedAt) {
      // Use generic message to avoid user enumeration
      throw new UnauthorizedException('Invalid credentials');
    }

    // Check account lockout
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      const remainingMs = user.lockedUntil.getTime() - Date.now();
      const remainingMinutes = Math.ceil(remainingMs / 60000);
      throw new ForbiddenException(
        `Account is locked. Try again in ${remainingMinutes} minute(s).`,
      );
    }

    const passwordValid = await argon2.verify(user.passwordHash, dto.password);

    if (!passwordValid) {
      const newFailedCount = user.failedLoginCount + 1;
      const shouldLock = newFailedCount >= MAX_FAILED_ATTEMPTS;

      await this.prisma.user.update({
        where: { id: user.id },
        data: {
          failedLoginCount: newFailedCount,
          lockedUntil: shouldLock
            ? new Date(Date.now() + LOCKOUT_DURATION_MS)
            : undefined,
        },
      });

      throw new UnauthorizedException('Invalid credentials');
    }

    // Reset failed count on successful auth
    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        failedLoginCount: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });

    // Handle 2FA
    if (user.twoFactorEnabled) {
      const challengeToken = uuidv4();
      challengeStore.set(challengeToken, {
        userId: user.id,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 min
      });
      return { requires2fa: true, challengeToken };
    }

    // Create session
    const { sid, sessionId } = await this.createSession(
      user.id,
      ip,
      userAgent,
      device,
    );

    const overrides = user.permissionOverrides.map((o: any) => ({
      key: o.key,
      effect: o.effect as 'grant' | 'revoke',
    }));

    return {
      user: buildSessionUser(user, sessionId, overrides),
      sid,
      cookieMaxAge: SESSION_MAX_AGE_MS,
    };
  }

  async verify2fa(
    dto: Verify2faDto,
    ip?: string,
    userAgent?: string,
    device?: string,
  ): Promise<{ user: SessionUserDto; sid: string; cookieMaxAge: number }> {
    const challenge = challengeStore.get(dto.challengeToken);

    if (!challenge || challenge.expiresAt < new Date()) {
      challengeStore.delete(dto.challengeToken);
      throw new UnauthorizedException('Invalid or expired 2FA challenge');
    }

    const user = await this.prisma.user.findUnique({
      where: { id: challenge.userId },
      include: { permissionOverrides: true },
    });

    if (!user || !user.isActive || !user.twoFactorSecret) {
      throw new UnauthorizedException('Invalid 2FA challenge');
    }

    const isValid = authenticator.verify({
      token: dto.totpCode,
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    challengeStore.delete(dto.challengeToken);

    const { sid, sessionId } = await this.createSession(
      user.id,
      ip,
      userAgent,
      device,
    );

    const overrides = user.permissionOverrides.map((o: any) => ({
      key: o.key,
      effect: o.effect as 'grant' | 'revoke',
    }));

    return {
      user: buildSessionUser(user, sessionId, overrides),
      sid,
      cookieMaxAge: SESSION_MAX_AGE_MS,
    };
  }

  async logout(sessionId: string): Promise<void> {
    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  async getActiveSessions(
    userId: string,
    currentSessionId: string,
  ) {
    const sessions = await this.prisma.session.findMany({
      where: {
        userId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { lastActiveAt: 'desc' },
    });

    return sessions.map((s: any) => ({
      id: s.id,
      device: s.device,
      ip: s.ip,
      userAgent: s.userAgent,
      createdAt: s.createdAt.toISOString(),
      lastActiveAt: s.lastActiveAt.toISOString(),
      isCurrent: s.id === currentSessionId,
    }));
  }

  async revokeSession(sessionId: string, userId: string): Promise<void> {
    const session = await this.prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session || session.userId !== userId) {
      throw new BadRequestException('Session not found');
    }

    await this.prisma.session.update({
      where: { id: sessionId },
      data: { revokedAt: new Date() },
    });
  }

  private async createSession(
    userId: string,
    ip?: string,
    userAgent?: string,
    device?: string,
  ): Promise<{ sid: string; sessionId: string }> {
    const sid = uuidv4();
    const cookieHash = hashCookieValue(sid);

    const session = await this.prisma.session.create({
      data: {
        userId,
        cookieHash,
        device: device ?? null,
        ip: ip ?? null,
        userAgent: userAgent ?? null,
        expiresAt: new Date(Date.now() + SESSION_MAX_AGE_MS),
      },
    });

    return { sid, sessionId: session.id };
  }
}
