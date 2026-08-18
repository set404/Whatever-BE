import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  const config = app.get(ConfigService);

  // Trust Render's reverse proxy so req.protocol reflects X-Forwarded-Proto
  // (https) rather than the http connection between the proxy and this app —
  // uploads.controller.ts builds absolute image URLs from req.protocol.
  app.set('trust proxy', 1);

  app.use(cookieParser());
  // FRONTEND_URL may include a path (e.g. GitHub Pages project sites are
  // served under /<repo>/ — needed as-is when building password-reset
  // links), but CORS only ever matches on origin, so derive that separately.
  // credentials: true is required for the refresh-token cookie to be
  // set/sent cross-origin (FE and BE are on different domains once deployed).
  const webFrontendOrigin = new URL(
    config.getOrThrow<string>('FRONTEND_URL'),
  ).origin;
  app.enableCors({
    origin: [
      webFrontendOrigin,
      'http://localhost:4200', // local `ng serve`
      'https://localhost', // Capacitor's Android WebView (default androidScheme/hostname)
    ],
    credentials: true,
  });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.listen(process.env.PORT ?? 3000);
}
void bootstrap();
