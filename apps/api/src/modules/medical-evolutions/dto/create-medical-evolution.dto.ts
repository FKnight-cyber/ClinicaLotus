import { IsIn, IsISO8601, IsNotEmpty, IsOptional, IsString } from "class-validator";

export const professionalAreas = ["Médico", "Terapeuta", "Psicólogo", "Psiquiatra", "Assistente social", "Enfermagem"] as const;

export class CreateMedicalEvolutionDto {
  @IsString()
  @IsNotEmpty()
  text!: string;

  @IsIn(professionalAreas)
  professionalArea!: string;

  @IsOptional()
  @IsISO8601()
  evolutionDate?: string;

  @IsOptional()
  @IsString()
  professionalName?: string;
}