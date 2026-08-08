import { IsArray, IsString } from "class-validator";

export class UpdateUserClinicsDto {
  @IsArray()
  @IsString({ each: true })
  clinicIds!: string[];
}