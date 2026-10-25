import type { AuthProvider } from '@/auth/auth-provider.interface';

export function createAuthMiddleware(getAuth: () => AuthProvider | null) {
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

    async onResponse({ response }: { response: Response }) {
      if (response.status !== 401) {
        return;
      }

      const auth = getAuth();
      if (!auth) {
        return;
      }

      console.warn('[AuthMiddleware] Received 401 response, logging out');
      await auth.logout();
    },
  };
}
