import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString } from "class-validator";

export class ListAccessUsersQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  groupId?: string;

  @IsOptional()
  @IsIn(["PENDING", "ACTIVE", "INACTIVE"])
  status?: "PENDING" | "ACTIVE" | "INACTIVE";
}