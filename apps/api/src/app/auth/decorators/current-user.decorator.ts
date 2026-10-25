import { createParamDecorator } from '@nestjs/common';

import type {
  AuthenticatedRequest,
  AuthenticatedUser,
} from '@/app/auth/types/token.types';
import type { ExecutionContext } from '@nestjs/common';

/**
 * The authenticated caller. Fails closed: on a `@Public()` route there is no
 * identity, and handing back `undefined` would let a handler run unscoped.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthenticatedUser => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    if (!request.user) {
      throw new Error(
        '@CurrentUser() used on a route without authentication (@Public())',
      );
    }

    return request.user;
  },
);
