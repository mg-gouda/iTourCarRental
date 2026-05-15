import { IsString, IsOptional, IsEmail, IsDecimal, MinLength } from 'class-validator';

export class CreateCorporateAccountDto {
  @IsString() @MinLength(1) name: string;
  @IsOptional() @IsString() taxNumber?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() billingAddress?: string;
  @IsOptional() @IsDecimal() creditLimit?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() notes?: string;
}

export class UpdateCorporateAccountDto {
  @IsOptional() @IsString() @MinLength(1) name?: string;
  @IsOptional() @IsString() taxNumber?: string;
  @IsOptional() @IsString() contactName?: string;
  @IsOptional() @IsEmail() contactEmail?: string;
  @IsOptional() @IsString() contactPhone?: string;
  @IsOptional() @IsString() billingAddress?: string;
  @IsOptional() @IsDecimal() creditLimit?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsString() notes?: string;
}
