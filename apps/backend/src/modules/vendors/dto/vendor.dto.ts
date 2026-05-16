import { IsString, IsNotEmpty, IsOptional, IsBoolean } from 'class-validator';

export class CreateVendorDto {
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() contact?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() specialty?: string;
  @IsOptional() @IsString() warrantyTerms?: string;
}

export class UpdateVendorDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() contact?: string;
  @IsOptional() @IsString() phone?: string;
  @IsOptional() @IsString() specialty?: string;
  @IsOptional() @IsString() warrantyTerms?: string;
  @IsOptional() @IsBoolean() isActive?: boolean;
}
