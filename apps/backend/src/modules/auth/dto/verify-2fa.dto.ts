import { IsString, Length } from 'class-validator';

export class Verify2faDto {
  @IsString()
  challengeToken!: string;

  @IsString()
  @Length(6, 6, { message: 'TOTP code must be 6 digits' })
  totpCode!: string;
}
