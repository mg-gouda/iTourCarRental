import { IsString, MinLength, IsOptional, IsIn } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  fullName?: string;

  @IsOptional()
  @IsIn(['en', 'ar'])
  language?: string;

  @IsOptional()
  @IsString()
  themePreference?: string | null;
}

export class ChangePasswordDto {
  @IsString()
  @MinLength(1)
  currentPassword: string;

  @IsString()
  @MinLength(8)
  newPassword: string;
}

export class Verify2faDto {
  @IsString()
  totpCode: string;
}

export class Disable2faDto {
  @IsString()
  currentPassword: string;
}
