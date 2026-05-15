import {
  IsString, IsInt, IsEnum, IsOptional, IsDecimal,
  IsDateString, Min, MinLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export enum CarStatusDto {
  AVAILABLE = 'AVAILABLE',
  RENTED = 'RENTED',
  IN_MAINTENANCE = 'IN_MAINTENANCE',
  OUT_OF_SERVICE = 'OUT_OF_SERVICE',
}

export enum FuelTypeDto {
  PETROL = 'PETROL',
  DIESEL = 'DIESEL',
  HYBRID = 'HYBRID',
  ELECTRIC = 'ELECTRIC',
  LPG = 'LPG',
}

export enum TransmissionDto {
  MANUAL = 'MANUAL',
  AUTOMATIC = 'AUTOMATIC',
}

export class CreateCarDto {
  @IsString() @MinLength(1) make: string;
  @IsString() @MinLength(1) model: string;
  @IsInt() @Min(1900) year: number;
  @IsString() @MinLength(1) licensePlate: string;
  @IsString() @MinLength(1) vin: string;
  @IsString() categoryId: string;
  @IsEnum(TransmissionDto) transmission: TransmissionDto;
  @IsEnum(FuelTypeDto) fuelType: FuelTypeDto;
  @IsInt() @Min(1) seats: number;
  @IsString() homeBranchId: string;
  @IsOptional() @IsString() currentBranchId?: string;
  @IsOptional() @IsInt() @Min(0) currentMileage?: number;
  @IsOptional() @IsDecimal() purchaseCost?: string;
  @IsOptional() @IsDateString() purchasedAt?: string;
  @IsOptional() @IsDateString() registrationExpiry?: string;
  @IsOptional() @IsString() gpsDeviceId?: string;
}

export class UpdateCarDto {
  @IsOptional() @IsString() @MinLength(1) make?: string;
  @IsOptional() @IsString() @MinLength(1) model?: string;
  @IsOptional() @IsInt() @Min(1900) year?: number;
  @IsOptional() @IsString() @MinLength(1) licensePlate?: string;
  @IsOptional() @IsString() @MinLength(1) vin?: string;
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsEnum(TransmissionDto) transmission?: TransmissionDto;
  @IsOptional() @IsEnum(FuelTypeDto) fuelType?: FuelTypeDto;
  @IsOptional() @IsInt() @Min(1) seats?: number;
  @IsOptional() @IsString() homeBranchId?: string;
  @IsOptional() @IsString() currentBranchId?: string;
  @IsOptional() @IsInt() @Min(0) currentMileage?: number;
  @IsOptional() @IsDecimal() purchaseCost?: string;
  @IsOptional() @IsDateString() purchasedAt?: string;
  @IsOptional() @IsDateString() registrationExpiry?: string;
  @IsOptional() @IsString() gpsDeviceId?: string;
  @IsOptional() @IsEnum(CarStatusDto) status?: CarStatusDto;
}

export class UpdateCarStatusDto {
  @IsEnum(CarStatusDto) status: CarStatusDto;
}

export class TransferCarDto {
  @IsString() toBranchId: string;
  @IsOptional() @IsString() notes?: string;
}

export class CreateCarCategoryDto {
  @IsString() @MinLength(1) name: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}

export class UpdateCarCategoryDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsInt() sortOrder?: number;
}
