import {
  Body,
  Controller,
  Get,
  Injectable,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { ClsModule, ClsService } from 'nestjs-cls';
import request from 'supertest';

import { createClsConfig } from '@/app/config/cls.config';
import { configureHttpApplication } from '@/app/config/http.config';
import {
  AllExceptionsFilter,
  ProblemDetailsFilter,
  ThrottlerExceptionFilter,
} from '@/app/filters';

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
}

describe('http setup', () => {
  let app: NestExpressApplication;

  beforeAll(async () => {
    const fixture = await Test.createTestingModule({
      imports: [ClsModule.forRoot(createClsConfig())],
      controllers: [TestController],
      providers: [
        TestAuthGuard,
        AllExceptionsFilter,
        ProblemDetailsFilter,
        ThrottlerExceptionFilter,
      ],
    }).compile();
    app = fixture.createNestApplication<NestExpressApplication>({
      bodyParser: false,
    });
    app.useGlobalGuards(app.get(TestAuthGuard));
    configureHttpApplication(app);
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
});
