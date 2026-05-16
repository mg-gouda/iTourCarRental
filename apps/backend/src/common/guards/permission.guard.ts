import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { PERMISSION_KEY, BRANCH_SCOPED_KEY } from '../decorators';
import { isInBranchScope } from '@car-rental/permissions';
import { SessionUserDto, Role } from '@car-rental/shared-types';

@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermission = this.reflector.getAllAndOverride<string | undefined>(
      PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );

    const isBranchScoped = this.reflector.getAllAndOverride<boolean | undefined>(
      BRANCH_SCOPED_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<Request>();
    const user = request.user as SessionUserDto | undefined;

    // If no user is attached, AuthGuard should have caught it first.
    // Only enforce permission check if a permission key is declared.
    if (!user) {
      return true;
    }

    if (requiredPermission) {
      // The session user already carries the full effective permission set.
      // SUPER_ADMIN always passes; others must have the key in their permission set.
      const isSuperAdmin = user.role === Role.SUPER_ADMIN;
      const allowed = isSuperAdmin || user.permissions.includes(requiredPermission);

      if (!allowed) {
        throw new ForbiddenException(
          `Missing permission: ${requiredPermission}`,
        );
      }
    }

    if (isBranchScoped) {
      const branchId =
        (request.params?.['branchId'] as string | undefined) ??
        (request.query?.['branchId'] as string | undefined) ??
        ((request.body as Record<string, unknown>)?.['branchId'] as string | undefined);

      if (branchId) {
        const inScope = isInBranchScope(
          {
            role: user.role,
            overrides: [],
            branchScope: user.branchScope,
          },
          branchId,
        );

        if (!inScope) {
          throw new ForbiddenException('Access denied: branch out of scope');
        }
      }
    }

    return true;
  }
}
