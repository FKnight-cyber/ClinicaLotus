import { IsIn } from "class-validator";

export class UpdatePatientStatusDto {
  @IsIn(["ACTIVE", "INACTIVE"])
  status!: "ACTIVE" | "INACTIVE";
}