import { IsArray, IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";

export class CreateAnamnesisDto {
  @IsString()
  @IsNotEmpty()
  patientName!: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsString()
  clinicId?: string;

  @IsOptional()
  @IsObject()
  answers?: Record<string, Record<string, unknown>>;

  @IsOptional()
  @IsObject()
  customFields?: Record<string, Record<string, unknown[]>>;

  @IsOptional()
  @IsArray()
  templateConfig?: Record<string, unknown>[];
}