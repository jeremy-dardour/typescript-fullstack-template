import { RequestMethod } from '@nestjs/common';

import { redactCensor, redactPaths } from './redaction.config';

import type { Env } from '@/app/config';
import type { ConfigService } from '@nestjs/config';
import type { Params } from 'nestjs-pino';
import type { IncomingMessage, ServerResponse } from 'node:http';

/**
 * Create nestjs-pino configuration
 */
export function createLoggerConfig(config: ConfigService<Env, true>) {
  const nodeEnv: 'development' | 'production' | 'test' = config.get('NODE_ENV');
  const isProduction = nodeEnv === 'production';
  const logLevel = getLogLevel(nodeEnv);

  return {
    pinoHttp: {
      level: logLevel,
      genReqId: (_request, response) =>
        String(response.getHeader('X-Request-Id')),

      // Only log API paths (whitelist)
      autoLogging: {
        ignore: (req) => {
          const url = req.url ?? '';
          return !url.startsWith('/api');
        },
      },

      // Sensitive data redaction
      redact: {
        paths: redactPaths,
        censor: redactCensor,
      },

      // Serializers
      serializers: {
        req: (
          req: IncomingMessage & {
            id?: string;
            query?: unknown;
            params?: unknown;
          },
        ) => ({
          id: req.id,
          method: req.method,
          url: req.url,
          query: req.query,
          params: req.params,
          remoteAddress: req.socket?.remoteAddress,
          remotePort: req.socket?.remotePort,
        }),
        res: (res: ServerResponse) => ({
          statusCode: res.statusCode,
        }),
        err: (error: Error) => ({
          type: error.constructor.name,
          message: error.message,
          stack: error.stack,
        }),
      },

      customProps: (_request: IncomingMessage, response: ServerResponse) => ({
        correlationId: response.getHeader('X-Correlation-Id'),
        traceId: response.getHeader('Trace-Id'),
      }),

      customSuccessMessage: (req: IncomingMessage, res: ServerResponse) => {
        return `${req.method} ${req.url} ${res.statusCode}`;
      },

      customErrorMessage: (
        req: IncomingMessage,
        res: ServerResponse,
        error: Error,
      ) => {
        return `${req.method} ${req.url} ${res.statusCode} - ${error.message}`;
      },

      // Dev: use pino-pretty
      ...(!isProduction && {
        transport: {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: true,
            translateTime: 'HH:MM:ss',
            ignore: 'pid,hostname',
            messageFormat: '{context} | {msg}',
          },
        },
      }),
    },

    // Exclude health check routes
    exclude: [
      { method: RequestMethod.GET, path: '/health' },
      { method: RequestMethod.GET, path: '/health/live' },
      { method: RequestMethod.GET, path: '/health/ready' },
    ],
  } satisfies Params;
}

/**
 * Get log level by environment
 */
function getLogLevel(nodeEnv: 'development' | 'production' | 'test'): string {
  switch (nodeEnv) {
    case 'production': {
      return 'info';
    }
    case 'test': {
      return 'warn';
    }
    case 'development': {
      return 'debug';
    }
  }
}
