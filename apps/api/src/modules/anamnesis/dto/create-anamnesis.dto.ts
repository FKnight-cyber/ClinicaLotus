import { IsIn, IsNotEmpty, IsObject, IsOptional, IsString } from "class-validator";

export class CreateAnamnesisDto {
  @IsString()
  @IsNotEmpty()
  patientName!: string;

  @IsString()
  @IsIn(["draft", "finalized"])
  status!: "draft" | "finalized";

  @IsObject()
  answers!: Record<string, unknown>;

  @IsOptional()
  @IsString()
  professionalId?: string;
}