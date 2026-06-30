import { IsEmail, IsOptional, IsString } from "class-validator";

export class UpdateProfileDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;
}