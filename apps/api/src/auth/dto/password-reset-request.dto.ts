import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class PasswordResetRequestDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  loginId!: string;

  @IsString()
  @MaxLength(255)
  @IsEmail()
  email!: string;
}
