import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString } from "class-validator";

export class ListAccessGroupsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;
}