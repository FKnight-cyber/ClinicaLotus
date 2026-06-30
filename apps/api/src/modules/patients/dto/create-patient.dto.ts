import { IsISO8601, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreatePatientDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsISO8601()
  birthDate?: string;

  @IsOptional()
  @IsString()
  document?: string;
}