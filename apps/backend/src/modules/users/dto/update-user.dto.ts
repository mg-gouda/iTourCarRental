import {
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  IsArray,
} from 'class-validator';
import { Role } from '@car-rental/shared-types';

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  fullName?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchScope?: string[];

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsString()
  themePreference?: string | null;

  @IsOptional()
  @IsObject()
  notificationPrefs?: Record<string, unknown>;
}
