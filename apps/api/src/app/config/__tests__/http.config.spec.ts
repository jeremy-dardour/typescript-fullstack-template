import {
  Body,
  Controller,
  Get,
  HttpException,
  Injectable,
  Param,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import {
  Throttle,
  ThrottlerGuard,
  ThrottlerModule,
  ThrottlerStorage,
} from '@nestjs/throttler';
import { ClsModule, ClsService } from 'nestjs-cls';
import request from 'supertest';

import { createClsConfig } from '@/app/config/cls.config';
import { configureHttpApplication } from '@/app/config/http.config';
import {
  throttlerConfig,
  throttlerErrorMessage,
} from '@/app/config/security.config';
import { setupSwagger } from '@/app/config/swagger.config';
import { AllExceptionsFilter, ProblemDetailsFilter } from '@/app/filters';
import { problemDetailsSchema } from '@/shared/dtos/problem-details.dto';

import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';
import type { Request } from 'express';

@Injectable()
class TestAuthGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request>();
    if (req.headers.authorization !== 'Bearer test') {
      throw new UnauthorizedException('Missing token');
    }
    return true;
  }
}

@Controller('context')
class TestController {
  constructor(private readonly cls: ClsService) {}

  @Get()
  getContext() {
    return {
      requestId: this.cls.getId(),
      correlationId: this.cls.get<string>('correlationId'),
    };
  }

  @Post()
  echo(@Body() body: unknown) {
    return body;
  }

  @Get('limited')
  @Throttle({ default: { limit: 2, ttl: 60_000, blockDuration: 10_000 } })
  limited() {
    return this.getContext();
  }

  @Get('errors/:status')
  fail(@Param('status') status: string): never {
    throw new HttpException('Expected failure', Number(status));
  }

  @Get('unexpected')
  unexpected(): never {
    throw new Error('SELECT private_data FROM internal_table');
  }
}

describe('http setup', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [
        ClsModule.forRoot(createClsConfig()),
        ThrottlerModule.forRoot({
          throttlers: [throttlerConfig],
          errorMessage: throttlerErrorMessage,
        }),
      ],
      controllers: [TestController],
      providers: [
        { provide: ConfigService, useValue: new ConfigService() },
        TestAuthGuard,
        ThrottlerGuard,
        AllExceptionsFilter,
        ProblemDetailsFilter,
      ],
    }).compile();
    app = fixture.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    app.useGlobalGuards(app.get(TestAuthGuard), app.get(ThrottlerGuard));
    configureHttpApplication(app);
    setupSwagger(app);
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('shares generated identifiers between headers and controller context', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/context')
      .set('Authorization', 'Bearer test')
      .expect(200);

    expect(response.headers['x-request-id']).toEqual(expect.any(String));
    expect(response.headers['x-correlation-id']).toEqual(expect.any(String));
    expect(response.body).toEqual({
      requestId: response.headers['x-request-id'],
      correlationId: response.headers['x-correlation-id'],
    });
  });

  it('preserves supplied identifiers and valid W3C trace IDs', async () => {
    const traceId = '0123456789abcdef0123456789abcdef';
    const response = await request(app.getHttpServer())
      .get('/api/context')
      .set('Authorization', 'Bearer test')
      .set('X-Request-Id', 'request-from-client')
      .set('X-Correlation-Id', 'correlation-from-client')
      .set('Traceparent', `00-${traceId}-0123456789abcdef-01`)
      .expect(200);

    expect(response.headers['x-request-id']).toBe('request-from-client');
    expect(response.headers['x-correlation-id']).toBe(
      'correlation-from-client',
    );
    expect(response.headers['trace-id']).toBe(traceId);
  });

  it('preserves context on guard failures before controller interceptors', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/context')
      .set('X-Request-Id', 'unauthenticated-request')
      .expect(401);

    expect(response.headers['x-request-id']).toBe('unauthenticated-request');
    expect(response.body).toMatchObject({
      request_id: 'unauthenticated-request',
      correlation_id: response.headers['x-correlation-id'],
    });
  });

  it('establishes context before JSON parsing can reject the body', async () => {
    const response = await request(app.getHttpServer())
      .post('/api/context')
      .set('Content-Type', 'application/json')
      .set('X-Request-Id', 'malformed-json')
      .send('{')
      .expect(400);

    expect(response.headers['x-request-id']).toBe('malformed-json');
    expect(response.body).toMatchObject({
      request_id: 'malformed-json',
      correlation_id: response.headers['x-correlation-id'],
    });
  });

  it('adds identifiers to preflight responses that terminate in CORS middleware', async () => {
    const response = await request(app.getHttpServer())
      .options('/api/context')
      .set('Origin', 'https://client.example.com')
      .set('Access-Control-Request-Method', 'POST')
      .set('X-Request-Id', 'preflight-request')
      .expect(204);

    expect(response.headers['x-request-id']).toBe('preflight-request');
    expect(response.headers['x-correlation-id']).toEqual(expect.any(String));
  });

  it('adds identifiers and Problem Details on unknown routes', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/unknown-route')
      .set('X-Request-Id', 'missing-route')
      .expect(404);

    expect(response.headers['x-request-id']).toBe('missing-route');
    expect(response.body).toMatchObject({ request_id: 'missing-route' });
  });

  it('isolates concurrent request contexts', async () => {
    const responses = await Promise.all(
      ['first-request', 'second-request'].map((id) =>
        request(app.getHttpServer())
          .get('/api/context')
          .set('Authorization', 'Bearer test')
          .set('X-Request-Id', id)
          .set('X-Correlation-Id', id)
          .expect(200),
      ),
    );

    expect(responses.map((response): unknown => response.body)).toEqual([
      { requestId: 'first-request', correlationId: 'first-request' },
      { requestId: 'second-request', correlationId: 'second-request' },
    ]);
  });

  it('reports the actual rejecting limiter and remaining retry time', async () => {
    const increment = vi.spyOn(app.get(ThrottlerStorage), 'increment');
    const storageRecord = {
      totalHits: 3,
      timeToExpire: 50,
      isBlocked: true,
      timeToBlockExpire: 9,
    };
    increment
      .mockResolvedValueOnce(storageRecord)
      .mockResolvedValueOnce({ ...storageRecord, timeToBlockExpire: 4 });

    for (const retry of [9, 4]) {
      const response = await request(app.getHttpServer())
        .get('/api/context/limited')
        .set('Authorization', 'Bearer test')
        .expect(429);

      expect(response.headers['retry-after']).toBe(String(retry));
      expect(response.headers['x-ratelimit-limit']).toBe('2');
      expect(response.headers['x-ratelimit-remaining']).toBe('0');
      expect(response.headers['x-ratelimit-reset']).toBe(String(retry));
      expect(response.headers['content-type']).toContain(
        'application/problem+json',
      );
      expect(response.body).toMatchObject({
        detail: `You have exceeded 2 requests in 60 seconds. Retry in ${retry} seconds.`,
        request_id: response.headers['x-request-id'],
      });
    }
    expect(increment).toHaveBeenCalledWith(
      expect.any(String),
      60_000,
      2,
      10_000,
      'default',
    );
    increment.mockRestore();
  });

  it.each([400, 401, 403, 404, 422, 429, 500])(
    'emits schema-valid Problem Details for HTTP %i',
    async (status) => {
      const response = await request(app.getHttpServer())
        .get(`/api/context/errors/${status}`)
        .set('Authorization', 'Bearer test')
        .expect(status);

      expect(problemDetailsSchema.parse(response.body)).toMatchObject({
        status,
        detail: 'Expected failure',
        request_id: response.headers['x-request-id'],
      });
    },
  );

  it('keeps unexpected diagnostics out of the response', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/context/unexpected')
      .set('Authorization', 'Bearer test')
      .expect(500);

    expect(problemDetailsSchema.parse(response.body)).toMatchObject({
      detail: 'Internal server error',
    });
    expect(response.text).not.toContain('private_data');
  });

  it('publishes the schema-owned Problem Details component in OpenAPI', async () => {
    const response = await request(app.getHttpServer())
      .get('/api/swagger-json')
      .expect(200);
    const document: unknown = response.body;

    expect(document).toMatchObject({
      components: {
        schemas: {
          ProblemDetailsDto: {
            type: 'object',
            required: ['type', 'title', 'status'],
            properties: { errors: { type: 'array' } },
          },
        },
      },
      paths: {
        '/api/context': {
          get: {
            responses: {
              default: {
                content: {
                  'application/problem+json': {
                    schema: { $ref: '#/components/schemas/ProblemDetailsDto' },
                  },
                },
              },
            },
          },
        },
      },
    });
  });
});
