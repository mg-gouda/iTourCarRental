import { Role } from './enums';

export interface UserDto {
  id: string;
  email: string;
  fullName: string;
  role: Role;
  branchScope: string[];
  isActive: boolean;
  twoFactorEnabled: boolean;
  avatarUrl?: string;
  language: string;
  themePreference?: string | null;
  notificationPrefs: Record<string, unknown>;
  lastLoginAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SessionUserDto extends UserDto {
  sessionId: string;
  permissions: string[];
}

export interface CreateUserDto {
  email: string;
  fullName: string;
  role: Role;
  branchScope?: string[];
  password: string;
  language?: string;
}

export interface UpdateUserDto {
  fullName?: string;
  role?: Role;
  branchScope?: string[];
  isActive?: boolean;
  language?: string;
  themePreference?: string | null;
  notificationPrefs?: Record<string, unknown>;
}
