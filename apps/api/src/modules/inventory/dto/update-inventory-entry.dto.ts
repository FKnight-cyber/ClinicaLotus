import { Type } from "class-transformer";
import { IsDateString, IsInt, IsNotEmpty, IsNumber, IsOptional, IsString, Min } from "class-validator";

export class UpdateInventoryEntryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  productName?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  quantity?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  unitPrice?: number;

  @IsOptional()
  @IsDateString()
  entryDate?: string;
}