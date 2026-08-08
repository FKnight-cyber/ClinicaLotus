import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString } from "class-validator";

export class ListAccessAuditLogsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  page?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(["access_group", "access_user", "anamnesis_record", "AnamnesisRecord", "medical_evolution", "patient"])
  entity?: "access_group" | "access_user" | "anamnesis_record" | "AnamnesisRecord" | "medical_evolution" | "patient";

  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  clinicId?: string;
}