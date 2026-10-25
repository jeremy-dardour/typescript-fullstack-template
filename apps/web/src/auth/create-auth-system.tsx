import { FakeAuthProvider } from '@/auth/fake-auth-provider';
import { FakeSignInButton } from '@/auth/fake-sign-in-button';
import { env } from '@/config/env';

import type { AuthSystem } from '@/auth/auth.interface';

export function createAuthSystem(): AuthSystem {
  if (env.fakeAuth) {
    const session = new FakeAuthProvider();

    return {
      session,
      SignInButton: () => <FakeSignInButton provider={session} />,
    };
  }

  throw new Error(
    'No auth adapter configured. Set VITE_FAKE_AUTH=true for development, or implement an AuthSession for your identity provider (see docs/adr/0008-web-auth-module-boundaries.md).',
  );
}
