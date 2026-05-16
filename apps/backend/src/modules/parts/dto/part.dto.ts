import { IsString, IsNotEmpty, IsOptional, IsInt, Min } from 'class-validator';

export class CreatePartDto {
  @IsString() @IsNotEmpty() sku: string;
  @IsString() @IsNotEmpty() name: string;
  @IsOptional() @IsString() description?: string;
  @IsString() @IsNotEmpty() unitCost: string;
  @IsString() @IsNotEmpty() currency: string;
  @IsOptional() @IsInt() @Min(0) lowStockThreshold?: number;
}

export class UpdatePartDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
  @IsOptional() @IsString() unitCost?: string;
  @IsOptional() @IsString() currency?: string;
  @IsOptional() @IsInt() @Min(0) lowStockThreshold?: number;
}

export class AdjustStockDto {
  @IsString() @IsNotEmpty() branchId: string;
  @IsInt() quantity: number;
}
