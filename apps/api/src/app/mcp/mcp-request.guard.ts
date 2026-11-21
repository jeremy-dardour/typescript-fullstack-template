import {
  ForbiddenException,
  Injectable,
  UnsupportedMediaTypeException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { isMcpOriginAllowed } from '@/app/config';

import type { Env } from '@/app/config';
import type { CanActivate, ExecutionContext } from '@nestjs/common';
import type { Request, Response } from 'express';

@Injectable()
export class McpRequestGuard implements CanActivate {
  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const http = context.switchToHttp();
    const request = http.getRequest<Request>();
    const response = http.getResponse<Response>();
    response.setHeader('Cache-Control', 'private, no-store');

    const publicResource = this.config.getOrThrow('MCP_PUBLIC_URL', {
      infer: true,
    });
    const publicUrl = new URL(publicResource);
    const origin = request.headers.origin;
    if (
      !isMcpOriginAllowed(
        origin,
        publicResource,
        this.config.get('MCP_ALLOWED_ORIGINS', { infer: true }),
      )
    ) {
      throw new ForbiddenException('Browser origin is not permitted');
    }

    const allowedHosts = new Set([publicUrl.hostname]);
    if (this.config.get('NODE_ENV', { infer: true }) !== 'production') {
      for (const host of ['localhost', '127.0.0.1', '[::1]']) {
        allowedHosts.add(host);
      }
    }
    let hostname: string;
    try {
      hostname = new URL(`http://${request.headers.host ?? ''}`).hostname;
    } catch {
      throw new ForbiddenException('HTTP Host is not permitted');
    }
    if (!allowedHosts.has(hostname)) {
      throw new ForbiddenException('HTTP Host is not permitted');
    }

    if (
      request.method === 'POST' &&
      request.headers['content-type']
        ?.split(';', 1)[0]
        ?.trim()
        .toLowerCase() !== 'application/json'
    ) {
      throw new UnsupportedMediaTypeException('Use application/json');
    }
    return true;
  }
}
