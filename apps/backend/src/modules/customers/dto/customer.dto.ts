import {
  IsString, IsOptional, IsEmail, IsDateString, IsEnum,
  IsArray, ValidateNested, MinLength, IsInt, Min, Max,
} from 'class-validator';
import { Type } from 'class-transformer';

export enum CustomerSourceDto { ADMIN_CREATED = 'ADMIN_CREATED', SELF_REGISTERED = 'SELF_REGISTERED', WALK_IN = 'WALK_IN' }
export enum CustomerFlagDto { BLACKLISTED = 'BLACKLISTED', WATCHLIST = 'WATCHLIST', VIP = 'VIP' }
export enum LicenseTypeDto { NATIONAL = 'NATIONAL', INTERNATIONAL = 'INTERNATIONAL' }

export class DriverLicenseDto {
  @IsString() licenseNumber: string;
  @IsString() issuingCountry: string;
  @IsEnum(LicenseTypeDto) licenseType: LicenseTypeDto;
  @IsDateString() expiryDate: string;
  @IsOptional() @IsString() storageKey?: string;
}

export class AdditionalDriverDto {
  @IsString() @MinLength(1) fullName: string;
  @IsInt() @Min(18) @Max(99) age: number;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @ValidateNested() @Type(() => DriverLicenseDto) license?: DriverLicenseDto;
}

export class CreateCustomerDto {
  @IsString() @MinLength(1) fullName: string;
  @IsOptional() @IsEmail() email?: string;
  @IsString() @MinLength(1) phone: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsEnum(CustomerSourceDto) source: CustomerSourceDto;
  @IsOptional() @IsEnum(CustomerFlagDto) flag?: CustomerFlagDto;
  @IsOptional() @IsString() flagReason?: string;
  @IsOptional() @IsString() corporateAccountId?: string;
  @IsOptional() @IsString() internalNotes?: string;
  @IsOptional() @IsString() visibleNotes?: string;
  @IsOptional() @ValidateNested() @Type(() => DriverLicenseDto) primaryLicense?: DriverLicenseDto;
}

export class UpdateCustomerDto {
  @IsOptional() @IsString() @MinLength(1) fullName?: string;
  @IsOptional() @IsEmail() email?: string;
  @IsOptional() @IsString() @MinLength(1) phone?: string;
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() nationality?: string;
  @IsOptional() @IsDateString() dateOfBirth?: string;
  @IsOptional() @IsEnum(CustomerFlagDto) flag?: CustomerFlagDto | null;
  @IsOptional() @IsString() flagReason?: string;
  @IsOptional() @IsString() corporateAccountId?: string | null;
  @IsOptional() @IsString() internalNotes?: string;
  @IsOptional() @IsString() visibleNotes?: string;
}
