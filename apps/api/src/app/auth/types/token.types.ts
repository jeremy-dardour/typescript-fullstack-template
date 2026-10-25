import type { jwtPayloadSchema } from '@/app/auth/schemas/jwt-payload.schemas';
import type { Request } from 'express';
import type z from 'zod';

export type JwtPayload = z.infer<typeof jwtPayloadSchema>;

export interface VerifiedToken {
  payload: JwtPayload;
  protectedHeader: Record<string, unknown>;
}

export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
}

/**
 * The caller's identity, normalized from whichever strategy authenticated the
 * request. `sub` is the only claim OIDC guarantees to be stable per issuer, so
 * key anything you persist about a user on it.
 */
export interface AuthenticatedUser {
  sub: string;
  email?: string;
  name?: string;
}
