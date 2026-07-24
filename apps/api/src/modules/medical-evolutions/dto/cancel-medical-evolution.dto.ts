import { IsNotEmpty, IsString } from "class-validator";

export class CancelMedicalEvolutionDto {
  @IsString()
  @IsNotEmpty()
  reason!: string;
}