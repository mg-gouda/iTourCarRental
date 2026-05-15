import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { PERMISSION_KEY, BRANCH_SCOPED_KEY } from '../decorators';
import { canDo, isInBranchScope } from '@car-rental/permissions';
import { SessionUserDto } from '@car-rental/shared-types';

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
      const overrides = user.permissions.map((p) => ({
        key: p,
        effect: 'grant' as const,
      }));

      // We use the pre-built permissions array on sessionUser for speed.
      // canDo with the full override set built from the effective permissions list.
      const allowed = canDo(
        {
          role: user.role,
          overrides,
          branchScope: user.branchScope,
        },
        requiredPermission,
      );

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
