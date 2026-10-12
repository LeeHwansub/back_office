import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class UpdateUserRoleDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  roleCode!: string;
}
