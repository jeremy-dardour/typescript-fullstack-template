import { IncomingMessage, ServerResponse } from 'node:http';
import { Socket } from 'node:net';

import { ConfigService } from '@nestjs/config';

import { createLoggerConfig } from '@/app/logger/logger.config';

import type { Env } from '@/app/config';

it('logs the generated and validated identifiers written to the response', () => {
  const config = createLoggerConfig(
    new ConfigService<Env, true>({ NODE_ENV: 'test' }),
  );
  const options = config.pinoHttp;
  if (!options || Array.isArray(options) || !options.customProps) {
    throw new Error('Expected configured HTTP log properties');
  }
  const socket = new Socket();
  const request = new IncomingMessage(socket);
  request.headers.traceparent = 'invalid-unvalidated-trace';
  const response = new ServerResponse(request);
  response.setHeader('X-Correlation-Id', 'generated-correlation');
  expect(options.customProps(request, response)).toEqual({
    correlationId: 'generated-correlation',
    traceId: undefined,
  });
  response.setHeader('Trace-Id', '0123456789abcdef0123456789abcdef');
  expect(options.customProps(request, response)).toEqual({
    correlationId: 'generated-correlation',
    traceId: '0123456789abcdef0123456789abcdef',
  });
  socket.destroy();
});
