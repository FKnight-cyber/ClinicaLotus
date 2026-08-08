import { IsIn } from "class-validator";

export class UpdateClinicStatusDto {
  @IsIn(["ACTIVE", "INACTIVE"])
  status!: "ACTIVE" | "INACTIVE";
}
