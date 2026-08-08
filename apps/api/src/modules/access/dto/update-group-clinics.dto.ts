import { IsArray, IsString } from "class-validator";

export class UpdateGroupClinicsDto {
  @IsArray()
  @IsString({ each: true })
  clinicIds!: string[];
}
