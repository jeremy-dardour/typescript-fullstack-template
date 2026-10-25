import { createElement } from 'react';
import { vi } from 'vitest';

import { ANONYMOUS } from '@/auth/auth-state';

import type { AuthState } from '@/auth/auth-state';
import type { AuthSession, AuthSystem } from '@/auth/auth.interface';

export const STUB_USER = {
  sub: 'test-user',
  email: 'jane.doe@example.com',
  name: 'Jane Doe',
};

/** An in-memory AuthSystem. `setState` notifies subscribers: wrap it in `act`. */
export function createStubAuth(initialState?: AuthState): {
  auth: AuthSession;
  authSystem: AuthSystem;
  setState: (next: AuthState) => void;
} {
  let state: AuthState = initialState ?? {
    status: 'authenticated',
    user: STUB_USER,
  };
  const listeners = new Set<() => void>();
  const setState = (next: AuthState) => {
    state = next;
    for (const listener of listeners) listener();
  };

  const auth: AuthSession = {
    getState: () => state,
    subscribe: (listener) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    signOut: vi.fn(() => setState(ANONYMOUS)),
    getAccessToken: vi.fn().mockResolvedValue('mockAccessToken'),
  };
  const authSystem: AuthSystem = {
    session: auth,
    SignInButton: () =>
      createElement('button', { type: 'button' }, 'stub sign in'),
  };

  return { auth, authSystem, setState };
}
