import { IsNotEmpty, IsString } from "class-validator";

export class RequestPasswordChangeDto {
  @IsString()
  @IsNotEmpty()
  login!: string;

  @IsString()
  @IsNotEmpty()
  password!: string;
}