import { ANONYMOUS } from '@/auth/auth-state';
import { generateFakeJwt } from '@/auth/utils/generate-fake-jwt';

import type { AuthState } from '@/auth/auth-state';
import type { AuthChangeListener, AuthSession } from '@/auth/auth.interface';
import type { AuthenticatedUser } from '@/auth/types';

// The same identity the API's MockAuthStrategy reports under FAKE_AUTH.
const DEV_USER: AuthenticatedUser = {
  sub: 'mock-user',
  email: 'mock@example.com',
  name: 'MockUser',
};

/**
 * Development and e2e session: starts signed in as a fixed user and mints a
 * local JWT, which the API accepts under FAKE_AUTH. It makes no network call,
 * so web e2e can run with the API mocked.
 */
export class FakeAuthProvider implements AuthSession {
  private state: AuthState = { status: 'authenticated', user: DEV_USER };
  private readonly listeners = new Set<AuthChangeListener>();

  getState(): AuthState {
    return this.state;
  }

  subscribe(listener: AuthChangeListener): () => void {
    this.listeners.add(listener);

    return () => {
      this.listeners.delete(listener);
    };
  }

  authenticate(): void {
    this.setState({ status: 'authenticated', user: DEV_USER });
  }

  signOut(): void {
    this.setState(ANONYMOUS);
  }

  getAccessToken(): Promise<string> {
    if (this.state.status !== 'authenticated') {
      return Promise.reject(
        new Error('[FakeAuthProvider] User is not authenticated'),
      );
    }

    return Promise.resolve(generateFakeJwt(DEV_USER.sub, DEV_USER.email ?? ''));
  }

  private setState(next: AuthState): void {
    this.state = next;
    for (const listener of this.listeners) {
      listener();
    }
  }
}
