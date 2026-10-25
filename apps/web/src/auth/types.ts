/** Mirrors the API's normalized caller identity (`GET /api/me`). */
export interface AuthenticatedUser {
  sub: string;
  email?: string;
  name?: string;
}
