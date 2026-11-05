import { Injectable, CanActivate } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';

import { IS_PUBLIC_KEY } from '@/app/auth/decorators';
import { JwtAuthService } from '@/app/auth/strategies/jwt/jwt-auth.service';
import { MockAuthService } from '@/app/auth/strategies/mock-auth.service';
import { AuthenticatedRequest } from '@/app/auth/types/token.types';
import { shouldUseMockAuth } from '@/app/auth/utils/should-use-mock-auth.util';

import type { AuthStrategy } from '@/app/auth/strategies/auth-strategy.types';
import type { Env } from '@/app/config';
import type { ExecutionContext } from '@nestjs/common';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly authStrategy: AuthStrategy;

  constructor(
    private readonly configService: ConfigService<Env, true>,
    private readonly reflector: Reflector,
    private readonly jwtAuthStrategy: JwtAuthService,
    private readonly mockAuthStrategy: MockAuthService,
  ) {
    this.authStrategy = shouldUseMockAuth(this.configService)
      ? this.mockAuthStrategy
      : this.jwtAuthStrategy;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const payload = await this.authStrategy.authenticate(request);
    request.user = payload;

    return true;
  }
}
