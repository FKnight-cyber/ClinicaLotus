import { Module } from "@nestjs/common";
import { AccessController } from "./access.controller";
import { AccessService } from "./access.service";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [AuthModule],
  controllers: [AccessController],
  providers: [AccessService]
})
export class AccessModule {}