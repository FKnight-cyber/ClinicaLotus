import { IsEmail, IsOptional, IsString, MinLength } from "class-validator";

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  login?: string;

  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  professionalArea?: string;

  @IsOptional()
  @IsString()
  professionalCouncil?: string;

  @IsOptional()
  @IsString()
  professionalRegistration?: string;

  @IsOptional()
  @IsString()
  professionalCouncilState?: string;

  @IsOptional()
  @IsString()
  professionalSpecialty?: string;

  @IsOptional()
  @IsString()
  @MinLength(6)
  password?: string;
}