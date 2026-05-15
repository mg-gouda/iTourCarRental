import {
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  IsArray,
  MinLength,
} from 'class-validator';
import { Role } from '@car-rental/shared-types';

export class CreateUserDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(2)
  fullName!: string;

  @IsEnum(Role)
  role!: Role;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  branchScope?: string[];

  @IsString()
  @MinLength(8)
  password!: string;

  @IsOptional()
  @IsString()
  language?: string;
}
