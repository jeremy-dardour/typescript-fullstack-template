import process from 'node:process';

import type { Env } from '@/app/config/env.schema';
import type { ExecutionContext } from '@nestjs/common';
import type {
  CorsOptions,
  CorsOptionsDelegate,
} from '@nestjs/common/interfaces/external/cors-options.interface';
import type { ConfigService } from '@nestjs/config';
import type { ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Request, Response } from 'express';

/**
 * CORS configuration
 */
export const corsConfig: CorsOptions = {
  // Allowed origins (production should specify exact domains)
  origin:
    process.env.NODE_ENV === 'production'
      ? (process.env.ALLOWED_ORIGINS?.split(',') ?? [])
      : true, // Allow all origins in dev
  // Allowed HTTP methods
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  // Allowed request headers
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Accept',
    'X-Correlation-Id',
    'X-Request-Id',
    'MCP-Protocol-Version',
    'Mcp-Method',
    'Mcp-Name',
    'Last-Event-ID',
    'Traceparent',
    'Tracestate',
    'API-Version',
    'Cache-Control',
    'Pragma',
  ],
  // Exposed response headers (RFC standard tracing)
  exposedHeaders: [
    'X-Request-Id',
    'X-Correlation-Id',
    'WWW-Authenticate',
    'Trace-Id',
    'Link',
    'Location',
    'Retry-After',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
    'Deprecation',
    'Sunset',
    'Warning',
  ],
  // Allow credentials (cookies)
  credentials: true,
  // Preflight cache time (seconds)
  maxAge: 3600,
};

export function isMcpOriginAllowed(
  origin: string | undefined,
  publicUrl: string | undefined,
  additionalOrigins: readonly string[],
): boolean {
  return (
    !origin ||
    additionalOrigins.includes(origin) ||
    (publicUrl !== undefined && new URL(publicUrl).origin === origin)
  );
}

export function isMcpHttpPath(path: string): boolean {
  const normalized = path.replace(/\/$/, '');
  return (
    normalized === '/mcp' ||
    normalized === '/.well-known/oauth-protected-resource/mcp'
  );
}

export function createCorsDelegate(
  config: ConfigService<Env, true>,
): CorsOptionsDelegate<Request> {
  return (request, callback) => {
    const isMcp = isMcpHttpPath(request.path);
    callback(
      null,
      isMcp
        ? {
            ...corsConfig,
            origin: isMcpOriginAllowed(
              request.headers.origin,
              config.get('MCP_PUBLIC_URL', { infer: true }),
              config.get('MCP_ALLOWED_ORIGINS', { infer: true }) ?? [],
            ),
          }
        : corsConfig,
    );
  };
}

/**
 * Rate limiting config to prevent API abuse
 */
export const throttlerConfig = {
  // Time window (ms)
  ttl: 60_000, // 60 seconds
  // Max requests per window
  limit: 30, // requests per minute
  ignoreUserAgents: [],
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
};

export function throttlerErrorMessage(
  context: ExecutionContext,
  { limit, ttl, timeToBlockExpire }: ThrottlerLimitDetail,
): string {
  const response = context.switchToHttp().getResponse<Response>();
  response.setHeader('Retry-After', timeToBlockExpire);
  response.setHeader('X-RateLimit-Limit', limit);
  response.setHeader('X-RateLimit-Remaining', 0);
  response.setHeader('X-RateLimit-Reset', timeToBlockExpire);
  return `You have exceeded ${limit} requests in ${ttl / 1000} seconds. Retry in ${timeToBlockExpire} seconds.`;
}
