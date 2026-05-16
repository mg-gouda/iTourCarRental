import { IsString, IsOptional, IsBoolean, IsInt, IsDateString, IsNumber, IsArray, ValidateNested, Min } from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRateRuleDto {
  @IsString() categoryId: string;
  @IsNumber() dailyRate: number;
  @IsOptional() @IsNumber() weeklyRate?: number;
  @IsOptional() @IsNumber() monthlyRate?: number;
  @IsString() currency: string;
}

export class UpdateRateRuleDto {
  @IsOptional() @IsString() categoryId?: string;
  @IsOptional() @IsNumber() dailyRate?: number;
  @IsOptional() @IsNumber() weeklyRate?: number;
  @IsOptional() @IsNumber() monthlyRate?: number;
  @IsOptional() @IsString() currency?: string;
}

export class CreateRatePlanDto {
  @IsString() name: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() corporateAccountId?: string;
  @IsDateString() startAt: string;
  @IsDateString() endAt: string;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
  @IsOptional() @IsArray() @ValidateNested({ each: true }) @Type(() => CreateRateRuleDto) rules?: CreateRateRuleDto[];
}

export class UpdateRatePlanDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() branchId?: string;
  @IsOptional() @IsString() corporateAccountId?: string;
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() endAt?: string;
  @IsOptional() @IsInt() priority?: number;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class CreateExtraDto {
  @IsString() code: string;
  @IsString() name: string;
  @IsString() pricingMode: string; // 'per_day' | 'per_rental' | 'per_unit'
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpdateExtraDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() pricingMode?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}

export class UpsertExtraPriceDto {
  @IsString() extraId: string;
  @IsNumber() amount: number;
  @IsString() currency: string;
}
