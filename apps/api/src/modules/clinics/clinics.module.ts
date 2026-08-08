import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { ClinicsController } from "./clinics.controller";
import { ClinicsService } from "./clinics.service";

@Module({
  imports: [AuthModule],
  controllers: [ClinicsController],
  providers: [ClinicsService]
})
export class ClinicsModule {}
