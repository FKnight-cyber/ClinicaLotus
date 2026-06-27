import { Global, Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";

export const POSTGRES_POOL = Symbol("POSTGRES_POOL");

@Global()
@Module({
  providers: [
    {
      provide: POSTGRES_POOL,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const connectionString = config.get<string>("DATABASE_URL");
        return new Pool({ connectionString });
      }
    }
  ],
  exports: [POSTGRES_POOL]
})
export class DatabaseModule {}