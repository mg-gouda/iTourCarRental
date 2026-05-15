import { IsBoolean, IsObject, IsOptional, IsString } from 'class-validator';

export class UpdateStylingDto {
  @IsOptional()
  @IsString()
  logoKey?: string | null;

  @IsOptional()
  @IsString()
  altLogoKey?: string | null;

  @IsOptional()
  @IsString()
  faviconKey?: string | null;

  @IsOptional()
  @IsObject()
  tokens?: Record<string, string>;

  @IsOptional()
  @IsObject()
  darkTokens?: Record<string, string>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}
