import { Test } from '@nestjs/testing';

import { OidcDiscoveryService } from '@/app/auth/strategies/jwt/oidc-discovery.service';
import { configureHttpApplication } from '@/app/config';
import { AppModule } from '@/app.module';

import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { TestingModule } from '@nestjs/testing';

export async function createTestApp({
  oidcOverride,
}: {
  oidcOverride?: Partial<OidcDiscoveryService>;
}): Promise<INestApplication> {
  const testModuleBuilder = Test.createTestingModule({
    imports: [AppModule],
  });

  if (oidcOverride) {
    testModuleBuilder
      .overrideProvider(OidcDiscoveryService)
      .useValue(oidcOverride);
  }

  const moduleFixture: TestingModule = await testModuleBuilder.compile();

  const app = moduleFixture.createNestApplication<NestExpressApplication>({
    bodyParser: false,
  });
  configureHttpApplication(app);
  await app.init();

  return app;
}
