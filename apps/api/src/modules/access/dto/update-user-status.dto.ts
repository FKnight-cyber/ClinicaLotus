import { IsIn } from "class-validator";

export class UpdateUserStatusDto {
  @IsIn(["PENDING", "ACTIVE", "INACTIVE"])
  status!: "PENDING" | "ACTIVE" | "INACTIVE";
}