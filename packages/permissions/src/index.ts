import { Role } from '@car-rental/shared-types';
import { ROLE_DEFAULTS, ALL_PERMISSIONS } from './role-defaults';

export { ROLE_DEFAULTS, ALL_PERMISSIONS } from './role-defaults';
export type { PermissionOverride } from './types';
import type { PermissionOverride } from './types';

export interface CanDoUser {
  role: Role;
  overrides: PermissionOverride[];
  branchScope: string[];
}

/**
 * Core resolver — mirrors PERMISSIONS.md resolution algorithm exactly.
 * This same logic runs on both backend (enforcement) and frontend (UI gating).
 */
export function canDo(user: CanDoUser, key: string): boolean {
  // 1. Super Admin bypasses all checks
  if (user.role === Role.SUPER_ADMIN) return true;

  // 2. Check for an explicit per-user override
  const override = user.overrides.find((o) => o.key === key);
  if (override?.effect === 'grant') return true;
  if (override?.effect === 'revoke') return false;

  // 3. Fall back to role default
  return ROLE_DEFAULTS[user.role]?.has(key) ?? false;
}

/**
 * Build the flat effective permission set for a user.
 * Useful for serialising into the session payload.
 */
export function buildEffectivePermissions(user: CanDoUser): Set<string> {
  if (user.role === Role.SUPER_ADMIN) {
    return new Set(ALL_PERMISSIONS);
  }

  const base = new Set(ROLE_DEFAULTS[user.role] ?? []);

  for (const override of user.overrides) {
    if (override.effect === 'grant') base.add(override.key);
    else if (override.effect === 'revoke') base.delete(override.key);
  }

  return base;
}

/**
 * Branch-scope guard. Always run alongside canDo for branch-scoped roles.
 * Super Admin and roles with empty branchScope have global access.
 */
export function isInBranchScope(user: CanDoUser, branchId: string): boolean {
  if (user.role === Role.SUPER_ADMIN) return true;
  if (user.branchScope.length === 0) return true;
  return user.branchScope.includes(branchId);
}
