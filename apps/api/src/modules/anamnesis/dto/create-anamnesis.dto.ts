import { IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";

export class CreateAnamnesisDto {
  @IsString()
  @IsNotEmpty()
  patientName!: string;

  @IsOptional()
  @IsString()
  patientId?: string;

  @IsOptional()
  @IsObject()
  answers?: Record<string, Record<string, unknown>>;
}