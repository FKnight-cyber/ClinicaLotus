import { IsISO8601, IsNotEmpty, IsOptional, IsString } from "class-validator";

export class UpdatePatientDto {
  @IsOptional()
  @IsString()
  clinicId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsISO8601()
  admissionDate?: string | null;

  @IsOptional()
  @IsISO8601()
  dischargeDate?: string | null;

  @IsOptional()
  @IsISO8601()
  birthDate?: string | null;

  @IsOptional()
  @IsString()
  document?: string | null;

  @IsOptional()
  @IsString()
  cpf?: string | null;

  @IsOptional()
  @IsString()
  rg?: string | null;
}