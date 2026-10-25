import type { AuthSession } from '@/auth/auth.interface';

export function createAuthMiddleware(getAuth: () => AuthSession | null) {
  return {
    async onRequest({ request }: { request: Request }) {
      const auth = getAuth();
      if (!auth) return;

      try {
        const token = await auth.getAccessToken();
        if (token) request.headers.set('Authorization', `Bearer ${token}`);
      } catch (error) {
        console.error('[AuthMiddleware] token error', error);
      }
    },

    onResponse({ response }: { response: Response }) {
      if (response.status !== 401) {
        return;
      }

      const auth = getAuth();
      if (!auth) {
        return;
      }

      // Only 401: a 403 is an ordinary permission denial, not a dead session.
      console.warn('[AuthMiddleware] Received 401 response, signing out');
      auth.signOut();
    },
  };
}
