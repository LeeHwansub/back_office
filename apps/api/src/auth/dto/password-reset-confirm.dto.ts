import {
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class PasswordResetConfirmDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(200)
  @Matches(/[A-Za-z]/)
  @Matches(/[0-9]/)
  newPassword!: string;
}
