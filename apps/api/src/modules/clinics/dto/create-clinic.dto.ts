import { IsNotEmpty, IsOptional, IsString } from "class-validator";

export class CreateClinicDto {
  @IsString()
  @IsNotEmpty()
  name!: string;

  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  document?: string;
}
