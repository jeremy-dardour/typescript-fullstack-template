import { Catch, HttpException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import {
  ExpiredTokenException,
  InsufficientScopesException,
  InvalidTokenException,
} from '@/app/auth';
import { ProblemDetailsFilter } from '@/app/filters';
import { McpRateLimitException } from '@/app/mcp/mcp-rate-limit.errors';

import type { Env } from '@/app/config';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

function quoteChallenge(value: string): string {
  return `"${value.replaceAll('\\', '\\\\').replaceAll('"', '\\"')}"`;
}

@Catch(HttpException)
export class McpExceptionFilter implements ExceptionFilter<HttpException> {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly problemDetails: ProblemDetailsFilter,
  ) {}

  catch(exception: HttpException, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    if (response.headersSent || response.destroyed) return;

    const status = exception.getStatus();
    const resource = new URL(
      this.config.getOrThrow('MCP_PUBLIC_URL', { infer: true }),
    );
    const metadataUrl = new URL(
      '/.well-known/oauth-protected-resource/mcp',
      resource,
    ).href;
    if (status === 401 || exception instanceof InsufficientScopesException) {
      const parameters = [`resource_metadata=${quoteChallenge(metadataUrl)}`];
      if (
        exception instanceof ExpiredTokenException ||
        exception instanceof InvalidTokenException
      ) {
        parameters.push('error="invalid_token"');
      }
      if (exception instanceof InsufficientScopesException) {
        parameters.push('error="insufficient_scope"');
        const scope = this.config.get('AUTH_ACCEPTED_SCOPES', {
          infer: true,
        })?.[0];
        if (scope) parameters.push(`scope=${quoteChallenge(scope)}`);
      }
      response.setHeader('WWW-Authenticate', `Bearer ${parameters.join(', ')}`);
    }
    if (exception instanceof McpRateLimitException) {
      const remainingSeconds = Math.ceil(
        (exception.resetAt - Date.now()) / 1000,
      );
      response.setHeader('Retry-After', String(Math.max(1, remainingSeconds)));
      response.setHeader('X-RateLimit-Limit', String(exception.limit));
      response.setHeader('X-RateLimit-Remaining', '0');
      response.setHeader(
        'X-RateLimit-Reset',
        String(Math.ceil(exception.resetAt / 1000)),
      );
    }
    this.problemDetails.catch(exception, host);
  }
}
