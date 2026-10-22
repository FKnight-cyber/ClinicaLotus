import { Type } from "class-transformer";
import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsString, Min } from "class-validator";

export class CreateInventoryEntryDto {
  @IsString()
  @IsNotEmpty()
  productName!: string;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice!: number;

  @IsDateString()
  entryDate!: string;

  @IsString()
  @IsNotEmpty()
  clinicId!: string;
}