import { IsObject, IsOptional, IsString } from "class-validator";

export class UpdateAnamnesisDto {
  @IsOptional()
  @IsString()
  patientName?: string;

  @IsOptional()
  @IsString()
  patientId?: string | null;

  @IsOptional()
  @IsObject()
  answers?: Record<string, Record<string, unknown>>;
}