import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AnamnesisController } from "./anamnesis.controller";
import { AnamnesisService } from "./anamnesis.service";

@Module({
  imports: [AuthModule],
  controllers: [AnamnesisController],
  providers: [AnamnesisService]
})
export class AnamnesisModule {}