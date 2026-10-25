import { createContext, use, useCallback, useSyncExternalStore } from 'react';

import type { AuthState } from '@/auth/auth-state';
import type { AuthSession, AuthSystem } from '@/auth/auth.interface';

export const AuthContext = createContext<AuthSystem | null>(null);

export function useAuthSystem(): AuthSystem {
  const authSystem = use(AuthContext);

  if (!authSystem) {
    throw new Error('useAuthSystem must be used within AuthContext');
  }

  return authSystem;
}

export function useAuth(): AuthSession {
  return useAuthSystem().session;
}

/**
 * Subscribes through useSyncExternalStore rather than a changing context
 * value, so the context stays stable and `useAuth()` is safe in dependency
 * arrays.
 */
export function useAuthState(): AuthState {
  const auth = useAuth();
  const subscribe = useCallback(
    (listener: () => void) => auth.subscribe(listener),
    [auth],
  );

  return useSyncExternalStore(subscribe, () => auth.getState());
}
