import { ValidationPipe } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);
  const webOrigins = config.get<string>("WEB_ORIGIN", "http://localhost:3000,http://127.0.0.1:3000,https://clinicaflordelotus.pages.dev")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);

  const isAllowedOrigin = (origin?: string) => {
    if (!origin || webOrigins.includes(origin)) return true;

    try {
      const parsedOrigin = new URL(origin);
      return parsedOrigin.protocol === "https:" && parsedOrigin.hostname.endsWith(".pages.dev");
    } catch {
      return false;
    }
  };

  app.enableCors({
    origin: (origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => callback(null, isAllowedOrigin(origin))
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.setGlobalPrefix("api");

  const fallbackPort = config.get<string>("NODE_ENV") === "production" ? 8081 : 3333;
  const port = Number(config.get<string>("PORT") ?? config.get<string>("API_PORT") ?? fallbackPort);
  await app.listen(port, "0.0.0.0");
  console.log(`API listening on port ${port}`);
}

void bootstrap();