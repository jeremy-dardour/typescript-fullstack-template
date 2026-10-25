import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { ProtectedRoute } from '@/app/components/protected-route';
import { AuthContext } from '@/auth';
import { createStubAuth } from '@/testing/stub-auth';

import type { AuthState } from '@/auth';

function renderRoute(initialState?: AuthState) {
  const stub = createStubAuth(initialState);
  render(
    <AuthContext value={stub.authSystem}>
      <ProtectedRoute>
        <div>protected content</div>
      </ProtectedRoute>
    </AuthContext>,
  );
  return stub;
}

describe('protectedRoute', () => {
  it('renders its children for an authenticated session', () => {
    renderRoute();

    expect(screen.getByText('protected content')).toBeVisible();
  });

  it('shows the sign-in landing instead of redirecting when anonymous', () => {
    renderRoute({ status: 'anonymous' });

    expect(screen.queryByText('protected content')).not.toBeInTheDocument();
    expect(screen.getByText('auth.landing.status.signIn')).toBeVisible();
    expect(screen.getByRole('button', { name: 'stub sign in' })).toBeVisible();
  });

  it('shows a pending state without a sign-in button while restoring', () => {
    renderRoute({ status: 'restoring' });

    expect(screen.getByText('auth.landing.status.checking')).toBeVisible();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
  });

  it('leaves the landing once the session authenticates', () => {
    const { setState } = renderRoute({ status: 'anonymous' });

    act(() =>
      setState({
        status: 'authenticated',
        user: { sub: 'test-user', name: 'Jane Doe' },
      }),
    );

    expect(screen.getByText('protected content')).toBeVisible();
  });
});
