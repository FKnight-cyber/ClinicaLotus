import { IsNotEmpty, IsString } from "class-validator";

export class SwitchActiveClinicDto {
  @IsString()
  @IsNotEmpty()
  clinicId!: string;
}
