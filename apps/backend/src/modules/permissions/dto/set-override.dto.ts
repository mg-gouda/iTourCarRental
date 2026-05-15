import { IsEnum, IsString } from 'class-validator';

export class SetOverrideDto {
  @IsString()
  key!: string;

  @IsEnum(['grant', 'revoke'])
  effect!: 'grant' | 'revoke';
}

export class UpdateRolePermissionDto {
  @IsString()
  key!: string;

  @IsEnum(['grant', 'revoke'])
  effect!: 'grant' | 'revoke';
}
