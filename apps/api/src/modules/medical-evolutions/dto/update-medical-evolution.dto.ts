import { IsIn, IsISO8601, IsOptional, IsString } from "class-validator";
import { professionalAreas } from "./create-medical-evolution.dto";

export class UpdateMedicalEvolutionDto {
  @IsOptional()
  @IsString()
  text?: string;

  @IsOptional()
  @IsIn(professionalAreas)
  professionalArea?: string;

  @IsOptional()
  @IsISO8601()
  evolutionDate?: string;

  @IsOptional()
  @IsString()
  professionalName?: string;
}