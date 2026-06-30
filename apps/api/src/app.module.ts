import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { AccessModule } from "./modules/access/access.module";
import { AnamnesisModule } from "./modules/anamnesis/anamnesis.module";
import { AuthModule } from "./modules/auth/auth.module";
import { PatientsModule } from "./modules/patients/patients.module";
import { AppCacheModule } from "./shared/cache/app-cache.module";
import { HealthController } from "./shared/health/health.controller";
import { PrismaModule } from "./shared/prisma/prisma.module";

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), AppCacheModule, PrismaModule, AuthModule, AccessModule, AnamnesisModule, PatientsModule],
  controllers: [HealthController]
})
export class AppModule {}