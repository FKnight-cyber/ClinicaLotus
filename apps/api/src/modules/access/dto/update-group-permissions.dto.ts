import { IsArray, IsString } from "class-validator";

export class UpdateGroupPermissionsDto {
  @IsArray()
  @IsString({ each: true })
  permissionKeys!: string[];
}