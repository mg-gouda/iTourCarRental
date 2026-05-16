import { IsString, IsOptional, IsNotEmpty, IsDateString, IsIn } from 'class-validator';

// ── Damage DTOs ──────────────────────────────────────────────────────────────

export class CreateDamageDto {
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  /** Decimal string, e.g. "350.00" */
  @IsString()
  @IsNotEmpty()
  estimatedCost: string;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsOptional()
  @IsString()
  inspectionId?: string;
}

export class UpdateDamageDto {
  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  estimatedCost?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  inspectionId?: string;
}

// ── Fine DTOs ────────────────────────────────────────────────────────────────

export class CreateFineDto {
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsIn(['traffic', 'toll', 'parking', 'other'])
  kind: string;

  /** Decimal string, e.g. "200.00" */
  @IsString()
  @IsNotEmpty()
  amount: string;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsDateString()
  occurredAt: string;

  @IsOptional()
  @IsString()
  externalRef?: string;

  /** Decimal string for the admin service fee, if any. */
  @IsOptional()
  @IsString()
  serviceFee?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class UpdateFineDto {
  @IsOptional()
  @IsIn(['traffic', 'toll', 'parking', 'other'])
  kind?: string;

  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsDateString()
  occurredAt?: string;

  @IsOptional()
  @IsString()
  externalRef?: string;

  @IsOptional()
  @IsString()
  serviceFee?: string;

  @IsOptional()
  @IsString()
  notes?: string;
}
