import { HttpException, Injectable } from '@nestjs/common';

import { AuthenticationException } from '@/app/auth/exceptions/authentication.exception';
import { AuthStrategy } from '@/app/auth/strategies/auth-strategy.interface';
import { JwtVerificationService } from '@/app/auth/strategies/jwt/jwt-verification.service';
import {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '@/app/auth/types/token.types';

@Injectable()
export class JwtAuthStrategy implements AuthStrategy {
  constructor(private readonly jwtService: JwtVerificationService) {}

  async authenticate(
    request: AuthenticatedRequest,
  ): Promise<AuthenticatedUser> {
    const token = this.extractTokenFromHeader(request);

    try {
      const { payload } = await this.jwtService.verify(token);
      return { sub: payload.sub, email: payload.email, name: payload.name };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }

      throw new AuthenticationException(
        error instanceof Error ? error.message : 'Authentication failed',
      );
    }
  }

  private extractTokenFromHeader(request: AuthenticatedRequest): string {
    const authHeader = request.headers.authorization;

    if (!authHeader || typeof authHeader !== 'string') {
      throw new AuthenticationException('Missing authorization headers');
    }

    const [type, token] = authHeader.split(' ', 2);

    if (type !== 'Bearer' || !token) {
      throw new AuthenticationException('Missing authorization token');
    }

    return token;
  }
}
