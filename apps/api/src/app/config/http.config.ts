import { RequestMethod } from '@nestjs/common';
import { ClsMiddleware } from 'nestjs-cls';

import { createClsConfig } from '@/app/config/cls.config';
import { corsConfig } from '@/app/config/security.config';
import { createValidationPipe } from '@/app/config/validation.config';
import { AllExceptionsFilter, ProblemDetailsFilter } from '@/app/filters';
import {
  LinkHeaderInterceptor,
  LocationHeaderInterceptor,
  TimeoutInterceptor,
} from '@/app/interceptors';

import type { NestExpressApplication } from '@nestjs/platform-express';

/** Call before init/listen on an application created with bodyParser: false. */
export function configureHttpApplication(app: NestExpressApplication): void {
  app.set('trust proxy', true);
  // Mount explicitly so parser errors and CORS preflight share the same context.
  app.use(new ClsMiddleware(createClsConfig().middleware).use);
  app.enableCors(corsConfig);
  app.useBodyParser('json');
  app.useBodyParser('urlencoded', { extended: true });

  app.setGlobalPrefix('api', {
    exclude: [
      { path: 'health', method: RequestMethod.ALL },
      { path: 'health/{*path}', method: RequestMethod.ALL },
    ],
  });
  app.useGlobalFilters(
    app.get(AllExceptionsFilter),
    app.get(ProblemDetailsFilter),
  );
  app.useGlobalInterceptors(
    new TimeoutInterceptor(15_000),
    new LocationHeaderInterceptor(),
    new LinkHeaderInterceptor(),
  );
  app.useGlobalPipes(createValidationPipe());
}
