import { IsString, IsNotEmpty, IsOptional } from 'class-validator';

export class CreateAccidentDto {
  @IsString() @IsNotEmpty() carId: string;
  @IsOptional() @IsString() bookingId?: string;
  @IsString() @IsNotEmpty() occurredAt: string;
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() policeReportRef?: string;
  @IsString() @IsNotEmpty() description: string;
  @IsOptional() thirdPartyDetails?: Record<string, unknown>;
  @IsOptional() @IsString() insuranceClaimId?: string;
}

export class UpdateAccidentDto {
  @IsOptional() @IsString() location?: string;
  @IsOptional() @IsString() policeReportRef?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() thirdPartyDetails?: Record<string, unknown>;
  @IsOptional() @IsString() insuranceClaimId?: string;
}
