import { IsOptional, IsString } from "class-validator";

export class UpdateClinicDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  document?: string;
}
