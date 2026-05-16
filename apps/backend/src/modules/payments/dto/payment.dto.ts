import { IsString, IsOptional, IsEnum, IsNotEmpty } from 'class-validator';

export enum PaymentKind {
  RENTAL = 'RENTAL',
  DEPOSIT = 'DEPOSIT',
  ADDENDUM = 'ADDENDUM',
}

export enum PaymentMethod {
  CASH = 'CASH',
  CARD = 'CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
}

export class CreatePaymentDto {
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsEnum(PaymentKind)
  kind: PaymentKind;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  /** Decimal string, e.g. "1500.00" */
  @IsString()
  @IsNotEmpty()
  amount: string;

  @IsString()
  @IsNotEmpty()
  currency: string;

  @IsOptional()
  @IsString()
  reference?: string;

  @IsString()
  @IsNotEmpty()
  idempotencyKey: string;
}

export class VoidPaymentDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}
