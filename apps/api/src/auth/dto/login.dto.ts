import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class LoginDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  loginId!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  password!: string;

  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
