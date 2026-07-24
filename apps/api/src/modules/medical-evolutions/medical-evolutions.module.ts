import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { MedicalEvolutionsController } from "./medical-evolutions.controller";
import { MedicalEvolutionsService } from "./medical-evolutions.service";

@Module({
  imports: [AuthModule],
  controllers: [MedicalEvolutionsController],
  providers: [MedicalEvolutionsService]
})
export class MedicalEvolutionsModule {}