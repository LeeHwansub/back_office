import { INestApplication, ValidationPipe } from '@nestjs/common';
import { AllExceptionsFilter } from './common/errors/all-exceptions.filter';

const DEFAULT_WEB_URL = 'http://localhost:3000';

export function configureApp(app: INestApplication): void {
  app.setGlobalPrefix('api/v1');
  app.enableCors({
    origin: [process.env.WEB_URL || DEFAULT_WEB_URL],
    credentials: true,
  });
  app.useGlobalFilters(new AllExceptionsFilter());
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
}
