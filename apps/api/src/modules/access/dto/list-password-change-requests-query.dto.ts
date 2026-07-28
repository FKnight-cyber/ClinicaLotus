import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString } from "class-validator";

export class ListPasswordChangeRequestsQueryDto {
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
  @IsIn(["PENDING", "APPROVED", "CANCELED", "ALL"])
  status?: "PENDING" | "APPROVED" | "CANCELED" | "ALL";
}