import { IsArray, IsOptional, IsString } from "class-validator";

export class CreateAccessGroupDto {
  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permissionKeys?: string[];
}