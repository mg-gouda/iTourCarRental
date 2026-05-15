import { IsString, IsOptional, IsNotEmpty, IsIn, IsArray } from 'class-validator';

export class GenerateInvoiceDto {
  @IsString()
  @IsNotEmpty()
  bookingId: string;

  @IsOptional()
  @IsIn(['en', 'ar'])
  language?: string;

  /** 'rental' or 'addendum' */
  @IsOptional()
  @IsIn(['rental', 'addendum'])
  kind?: string;
}

export class VoidInvoiceDto {
  @IsString()
  @IsNotEmpty()
  reason: string;
}

export class CreateCreditNoteDto {
  /** Decimal string, e.g. "250.00" */
  @IsString()
  @IsNotEmpty()
  amount: string;

  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsArray()
  lineItems?: Record<string, unknown>[];

  @IsOptional()
  @IsIn(['en', 'ar'])
  language?: string;
}
