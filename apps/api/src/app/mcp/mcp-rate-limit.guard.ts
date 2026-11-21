import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { McpRateLimitException } from '@/app/mcp/mcp-rate-limit.errors';

import type { AuthenticatedRequest } from '@/app/auth';
import type { Env } from '@/app/config';
import type {
  CanActivate,
  ExecutionContext,
  OnModuleDestroy,
} from '@nestjs/common';

@Injectable()
export class McpRateLimitGuard implements CanActivate, OnModuleDestroy {
  private readonly windows = new Map<
    string,
    { count: number; resetAt: number }
  >();

  private readonly cleanup = setInterval(() => {
    const now = Date.now();
    for (const [subject, window] of this.windows) {
      if (window.resetAt <= now) this.windows.delete(subject);
    }
  }, 60_000).unref();

  constructor(private readonly config: ConfigService<Env, true>) {}

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const subject = request.user?.sub;
    if (!subject) throw new UnauthorizedException();

    const now = Date.now();
    const limit = this.config.get('MCP_RATE_LIMIT_PER_MINUTE', { infer: true });
    let window = this.windows.get(subject);
    if (!window || window.resetAt <= now) {
      window = { count: 0, resetAt: now + 60_000 };
      this.windows.set(subject, window);
    }
    if (window.count >= limit) {
      throw new McpRateLimitException(limit, window.resetAt);
    }
    window.count += 1;
    return true;
  }

  onModuleDestroy(): void {
    clearInterval(this.cleanup);
    this.windows.clear();
  }
}
