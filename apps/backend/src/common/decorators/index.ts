import {
  createParamDecorator,
  ExecutionContext,
  SetMetadata,
} from '@nestjs/common';
import { SessionUserDto } from '@car-rental/shared-types';

export const PERMISSION_KEY = 'required_permission';
export const PUBLIC_KEY = 'is_public';
export const BRANCH_SCOPED_KEY = 'is_branch_scoped';

/**
 * Extracts the authenticated user from the request.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): SessionUserDto => {
    const request = ctx.switchToHttp().getRequest();
    return request.user as SessionUserDto;
  },
);

/**
 * Requires the caller to hold a specific permission key.
 * Used together with PermissionGuard.
 */
export const RequirePermission = (key: string) => SetMetadata(PERMISSION_KEY, key);

/**
 * Marks a route as public — skips the AuthGuard entirely.
 */
export const Public = () => SetMetadata(PUBLIC_KEY, true);

/**
 * Marks a route as branch-scoped. The PermissionGuard will verify
 * that the acting user's branchScope includes the branch implied by
 * the request (via query.branchId or param.branchId or body.branchId).
 */
export const BranchScoped = () => SetMetadata(BRANCH_SCOPED_KEY, true);
