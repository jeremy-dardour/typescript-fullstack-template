import process from 'node:process';

import type { ExecutionContext } from '@nestjs/common';
import type { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import type { ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Response } from 'express';

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
