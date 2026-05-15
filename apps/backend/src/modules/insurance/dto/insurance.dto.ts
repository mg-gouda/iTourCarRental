import { IsString, IsOptional, IsDateString, IsDecimal, MinLength } from 'class-validator';

export class CreateInsurancePolicyDto {
  @IsString() carId: string;
  @IsString() @MinLength(1) provider: string;
  @IsString() @MinLength(1) policyNumber: string;
  @IsString() @MinLength(1) coverage: string;
  @IsDateString() startAt: string;
  @IsDateString() expiryAt: string;
  @IsOptional() @IsDecimal() premium?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateInsurancePolicyDto {
  @IsOptional() @IsString() @MinLength(1) provider?: string;
  @IsOptional() @IsString() @MinLength(1) policyNumber?: string;
  @IsOptional() @IsString() @MinLength(1) coverage?: string;
  @IsOptional() @IsDateString() startAt?: string;
  @IsOptional() @IsDateString() expiryAt?: string;
  @IsOptional() @IsDecimal() premium?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() notes?: string;
}

export class CreateInsuranceClaimDto {
  @IsOptional() @IsString() accidentId?: string;
  @IsOptional() @IsDecimal() amount?: string;
  @IsString() status: string;
  @IsDateString() filedAt: string;
  @IsOptional() @IsDateString() resolvedAt?: string;
  @IsOptional() @IsString() notes?: string;
}
