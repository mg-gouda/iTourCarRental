import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ALL_PERMISSIONS, ROLE_DEFAULTS, buildEffectivePermissions } from '@car-rental/permissions';
import { Role } from '@car-rental/shared-types';

@Injectable()
export class PermissionsService {
  constructor(private readonly prisma: PrismaService) {}

  async getRolePermissions(role: string) {
    const roleEnum = role as Role;
    const baseDefaults = ROLE_DEFAULTS[roleEnum] ?? new Set<string>();

    // Get any DB overrides for this role
    const dbOverrides = await this.prisma.rolePermission.findMany({
      where: { role: roleEnum },
    });

    const overrideMap = new Map(
      dbOverrides.map((r) => [r.key, r.granted]),
    );

    // Build final permission set: base defaults + DB overrides
    const permissions: Record<string, boolean> = {};

    for (const key of ALL_PERMISSIONS) {
      if (overrideMap.has(key)) {
        permissions[key] = overrideMap.get(key)!;
      } else {
        permissions[key] = baseDefaults.has(key);
      }
    }

    return {
      role: roleEnum,
      permissions,
    };
  }

  async getAllRolesPermissions() {
    const roles = Object.values(Role);
    const result = await Promise.all(roles.map((r) => this.getRolePermissions(r)));
    return result;
  }

  async updateRolePermission(
    role: string,
    key: string,
    effect: 'grant' | 'revoke',
    actorId: string,
  ) {
    const roleEnum = role as Role;

    if (!ALL_PERMISSIONS.has(key)) {
      throw new BadRequestException(`Unknown permission key: ${key}`);
    }

    await this.prisma.rolePermission.upsert({
      where: { role_key: { role: roleEnum, key } },
      update: { granted: effect === 'grant', updatedById: actorId },
      create: {
        role: roleEnum,
        key,
        granted: effect === 'grant',
        updatedById: actorId,
      },
    });

    return { role: roleEnum, key, effect };
  }

  async getUserOverrides(userId: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const overrides = await this.prisma.permissionOverride.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });

    return overrides.map((o) => ({
      id: o.id,
      key: o.key,
      effect: o.effect as 'grant' | 'revoke',
      createdAt: o.createdAt.toISOString(),
    }));
  }

  async setUserOverride(
    userId: string,
    key: string,
    effect: 'grant' | 'revoke',
    actorId: string,
  ) {
    const user = await this.prisma.user.findFirst({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    if (!ALL_PERMISSIONS.has(key)) {
      throw new BadRequestException(`Unknown permission key: ${key}`);
    }

    await this.prisma.permissionOverride.upsert({
      where: { userId_key: { userId, key } },
      update: { effect, createdById: actorId },
      create: { userId, key, effect, createdById: actorId },
    });

    return { userId, key, effect };
  }

  async deleteUserOverride(userId: string, key: string): Promise<void> {
    const override = await this.prisma.permissionOverride.findUnique({
      where: { userId_key: { userId, key } },
    });

    if (!override) {
      throw new NotFoundException('Permission override not found');
    }

    await this.prisma.permissionOverride.delete({
      where: { userId_key: { userId, key } },
    });
  }

  async getUserEffectivePermissions(userId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id: userId },
      include: { permissionOverrides: true },
    });

    if (!user) throw new NotFoundException('User not found');

    const overrides = user.permissionOverrides.map((o) => ({
      key: o.key,
      effect: o.effect as 'grant' | 'revoke',
    }));

    const effectiveSet = buildEffectivePermissions({
      role: user.role as Role,
      overrides,
      branchScope: user.branchScope,
    });

    return {
      userId,
      role: user.role,
      permissions: Array.from(effectiveSet).sort(),
    };
  }
}
