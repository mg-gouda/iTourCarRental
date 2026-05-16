import { IsString, IsOptional, IsNotEmpty } from 'class-validator';

export class CreateRefundDto {
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  /**
   * Decimal string, e.g. "750.00".
   * If omitted the service computes it from the cancellation policy.
   */
  @IsOptional()
  @IsString()
  amount?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsString()
  paymentId?: string;

  @IsOptional()
  @IsString()
  invoiceId?: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}
