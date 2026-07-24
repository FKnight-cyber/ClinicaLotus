import { IsEmail, IsIn, IsOptional, IsString } from "class-validator";

export class UpdateUserDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsIn(["MANAGER", "PATIENT", "NURSE", "DOCTOR"])
  userType?: "MANAGER" | "PATIENT" | "NURSE" | "DOCTOR";
}