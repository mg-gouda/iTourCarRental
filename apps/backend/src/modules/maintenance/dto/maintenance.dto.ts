import { IsString, IsNotEmpty, IsOptional, IsEnum, IsInt, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export enum MaintenanceKind {
  SCHEDULED = 'SCHEDULED',
  UNSCHEDULED = 'UNSCHEDULED',
}

export class MaintenancePartDto {
  @IsString() @IsNotEmpty() partId: string;
  @IsInt() @Min(1) quantity: number;
  @IsString() @IsNotEmpty() unitCost: string;
}

export class CreateMaintenanceDto {
  @IsString() @IsNotEmpty() carId: string;
  @IsEnum(MaintenanceKind) kind: MaintenanceKind;
  @IsString() @IsNotEmpty() startedAt: string;
  @IsOptional() @IsString() completedAt?: string;
  @IsInt() @Min(0) mileageAt: number;
  @IsString() @IsNotEmpty() cost: string;
  @IsString() @IsNotEmpty() currency: string;
  @IsString() @IsNotEmpty() description: string;
  @IsOptional() @IsString() vendorId?: string;
  @IsOptional() @IsString() mechanicId?: string;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => MaintenancePartDto)
  partsUsed?: MaintenancePartDto[];
}

export class UpdateMaintenanceDto {
  @IsOptional() @IsEnum(MaintenanceKind) kind?: MaintenanceKind;
  @IsOptional() @IsString() completedAt?: string;
  @IsOptional() @IsString() cost?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() vendorId?: string;
}
