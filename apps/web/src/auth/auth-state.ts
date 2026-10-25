import type { AuthenticatedUser } from '@/auth/types';

export type AuthState =
  | { status: 'restoring' } // initial status of adapters that recover a stored session
  | { status: 'anonymous' }
  | { status: 'authenticated'; user: AuthenticatedUser }
  | { status: 'error'; error: Error };

// Shared because they carry no data: `getState()` must return a stable
// reference until the state changes (it feeds useSyncExternalStore).
export const RESTORING: AuthState = { status: 'restoring' };
export const ANONYMOUS: AuthState = { status: 'anonymous' };
