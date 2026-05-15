import {
  Injectable,
  NotFoundException,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { Role } from '@car-rental/shared-types';
import * as argon2 from 'argon2';
import { authenticator } from 'otplib';
import * as qrcode from 'qrcode';
import { v4 as uuidv4 } from 'uuid';

type SafeUser = {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  branchScope: string[];
  isActive: boolean;
  twoFactorEnabled: boolean;
  avatarUrl: string | null;
  language: string;
  themePreference: string | null;
  notificationPrefs: Record<string, unknown>;
  lastLoginAt: string | null;
  createdAt: string;
  updatedAt: string;
};

function sanitizeUser(user: {
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
}): SafeUser {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role as Role,
    branchScope: user.branchScope,
    isActive: user.isActive,
    twoFactorEnabled: user.twoFactorEnabled,
    avatarUrl: user.avatarKey ? `/api/v1/files/${user.avatarKey}` : null,
    language: user.language,
    themePreference: user.themePreference,
    notificationPrefs: user.notificationPrefs as Record<string, unknown>,
    lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
    createdAt: user.createdAt.toISOString(),
    updatedAt: user.updatedAt.toISOString(),
  };
}

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(query: {
    page?: number;
    limit?: number;
    role?: Role;
    branchId?: string;
    isActive?: boolean;
  }) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const where: Record<string, unknown> = {};
    if (query.role) where['role'] = query.role;
    if (query.isActive !== undefined) where['isActive'] = query.isActive;
    if (query.branchId) where['branchScope'] = { has: query.branchId };

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: users.map(sanitizeUser),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  async findOne(id: string): Promise<SafeUser> {
    const user = await this.prisma.user.findFirst({ where: { id } });
    if (!user) throw new NotFoundException('User not found');
    return sanitizeUser(user);
  }

  async create(dto: CreateUserDto, actorId: string): Promise<SafeUser> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already in use');
    }

    const passwordHash = await argon2.hash(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        fullName: dto.fullName,
        role: dto.role,
        branchScope: dto.branchScope ?? [],
        language: dto.language ?? 'en',
        isActive: true,
      },
    });

    void actorId; // used for audit log upstream
    return sanitizeUser(user);
  }

  async update(id: string, dto: UpdateUserDto): Promise<SafeUser> {
    const user = await this.prisma.user.findFirst({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const updated = await this.prisma.user.update({
      where: { id },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.role !== undefined && { role: dto.role }),
        ...(dto.branchScope !== undefined && { branchScope: dto.branchScope }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
        ...(dto.language !== undefined && { language: dto.language }),
        ...(dto.themePreference !== undefined && { themePreference: dto.themePreference }),
        ...(dto.notificationPrefs !== undefined && { notificationPrefs: dto.notificationPrefs }),
      },
    });

    return sanitizeUser(updated);
  }

  async softDelete(id: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    await this.prisma.user.update({
      where: { id },
      data: { deletedAt: new Date(), isActive: false },
    });

    // Revoke all active sessions
    await this.prisma.session.updateMany({
      where: { userId: id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async adminResetPassword(id: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id } });
    if (!user) throw new NotFoundException('User not found');

    const passwordHash = await argon2.hash(newPassword);
    await this.prisma.user.update({
      where: { id },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
  }

  async updateProfile(
    userId: string,
    dto: {
      fullName?: string;
      language?: string;
      themePreference?: string | null;
      notificationPrefs?: Record<string, unknown>;
    },
  ): Promise<SafeUser> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: {
        ...(dto.fullName !== undefined && { fullName: dto.fullName }),
        ...(dto.language !== undefined && { language: dto.language }),
        ...(dto.themePreference !== undefined && { themePreference: dto.themePreference }),
        ...(dto.notificationPrefs !== undefined && { notificationPrefs: dto.notificationPrefs }),
      },
    });

    return sanitizeUser(updated);
  }

  async changePassword(userId: string, dto: ChangePasswordDto): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const valid = await argon2.verify(user.passwordHash, dto.currentPassword);
    if (!valid) throw new UnauthorizedException('Current password is incorrect');

    const passwordHash = await argon2.hash(dto.newPassword);
    await this.prisma.user.update({
      where: { id: userId },
      data: { passwordHash, passwordChangedAt: new Date() },
    });
  }

  async setup2fa(userId: string): Promise<{ secret: string; otpauthUrl: string; qrDataUrl: string }> {
    const user = await this.prisma.user.findFirst({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const secret = authenticator.generateSecret();
    const otpauthUrl = authenticator.keyuri(user.email, 'iTourCarRental', secret);

    // Store the secret temporarily (not enabled yet until verified)
    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorSecret: secret },
    });

    const qrDataUrl = await qrcode.toDataURL(otpauthUrl);

    return { secret, otpauthUrl, qrDataUrl };
  }

  async verify2faSetup(userId: string, totpCode: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId } });
    if (!user || !user.twoFactorSecret) {
      throw new BadRequestException('2FA setup not initiated');
    }

    const isValid = authenticator.verify({
      token: totpCode,
      secret: user.twoFactorSecret,
    });

    if (!isValid) {
      throw new UnauthorizedException('Invalid TOTP code');
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: true },
    });
  }

  async disable2fa(userId: string, currentPassword: string): Promise<void> {
    const user = await this.prisma.user.findFirst({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const valid = await argon2.verify(user.passwordHash, currentPassword);
    if (!valid) throw new UnauthorizedException('Incorrect password');

    await this.prisma.user.update({
      where: { id: userId },
      data: { twoFactorEnabled: false, twoFactorSecret: null },
    });
  }

  async updateAvatar(userId: string, storageKey: string): Promise<SafeUser> {
    const updated = await this.prisma.user.update({
      where: { id: userId },
      data: { avatarKey: storageKey },
    });
    return sanitizeUser(updated);
  }

  generateResetPassword(): string {
    return uuidv4().replace(/-/g, '').slice(0, 12) + 'Aa1!';
  }
}
