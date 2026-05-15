import { IsString, IsOptional, IsDateString, IsInt, IsBoolean, IsArray, ValidateNested, IsEnum, IsNumber, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class BookingExtraDto {
  @IsString() extraId: string;
  @IsInt() @Min(1) quantity: number;
}

export class CreateBookingDto {
  @IsString() customerId: string;
  @IsOptional() @IsString() corporateAccountId?: string;
  @IsString() carId: string;
  @IsString() pickupBranchId: string;
  @IsString() returnBranchId: string;
  @IsDateString() pickupAt: string;
  @IsDateString() returnAt: string;
  @IsEnum(['FULL_TO_FULL', 'PREPAID_FULL', 'RETURN_AS_RECEIVED']) fuelPolicy: string;
  @IsOptional() @IsInt() @Min(0) mileageAllowancePerDay?: number;
  @IsOptional() @IsInt() expectedKm?: number;
  @IsOptional() @IsString() promoCode?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BookingExtraDto) extras?: BookingExtraDto[];
  @IsOptional() @IsBoolean() leavesCountry?: boolean;
  @IsOptional() @IsString() internalNotes?: string;
  @IsOptional() @IsString() visibleNotes?: string;
  @IsOptional() @IsInt() driverAge?: number;
}

export class UpdateBookingDto {
  @IsOptional() @IsDateString() pickupAt?: string;
  @IsOptional() @IsDateString() returnAt?: string;
  @IsOptional() @IsString() returnBranchId?: string;
  @IsOptional() @IsEnum(['FULL_TO_FULL', 'PREPAID_FULL', 'RETURN_AS_RECEIVED']) fuelPolicy?: string;
  @IsOptional() @IsInt() mileageAllowancePerDay?: number;
  @IsOptional() @IsString() internalNotes?: string;
  @IsOptional() @IsString() visibleNotes?: string;
}

export class CancelBookingDto {
  @IsOptional() @IsString() reason?: string;
}

export class CheckinDto {
  @IsInt() mileage: number;
  @IsInt() @Min(0) @Max(100) fuelLevel: number;
  @IsOptional() exteriorDamage?: Record<string, unknown>;
  @IsOptional() @IsString() interiorCondition?: string;
}

export class CheckoutDto {
  @IsInt() mileage: number;
  @IsInt() @Min(0) @Max(100) fuelLevel: number;
  @IsOptional() exteriorDamage?: Record<string, unknown>;
  @IsOptional() @IsString() interiorCondition?: string;
}

export class QuoteDto {
  @IsString() carId: string;
  @IsString() pickupBranchId: string;
  @IsString() returnBranchId: string;
  @IsDateString() pickupAt: string;
  @IsDateString() returnAt: string;
  @IsOptional() @IsInt() @Min(16) driverAge?: number;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => BookingExtraDto) extras?: BookingExtraDto[];
  @IsOptional() @IsEnum(['FULL_TO_FULL', 'PREPAID_FULL', 'RETURN_AS_RECEIVED']) fuelPolicy?: string;
  @IsOptional() @IsInt() mileageAllowancePerDay?: number;
  @IsOptional() @IsString() promoCode?: string;
  @IsOptional() @IsString() corporateAccountId?: string;
}
