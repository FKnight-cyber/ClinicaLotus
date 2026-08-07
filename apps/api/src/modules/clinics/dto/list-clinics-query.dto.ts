import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString } from "class-validator";

export class ListClinicsQueryDto {
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
  @IsIn(["ACTIVE", "INACTIVE", "ALL"])
  status?: "ACTIVE" | "INACTIVE" | "ALL";
}
