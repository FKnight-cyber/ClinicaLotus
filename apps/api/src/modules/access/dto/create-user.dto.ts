import { IsArray, IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class CreateUserDto {
  @IsString()
  login!: string;

  @IsString()
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsString()
  @MinLength(6)
  password!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  groupIds?: string[];
}