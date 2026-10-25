import { act, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { AuthContext, useAuthState } from '@/auth/auth-context';
import { createStubAuth } from '@/testing/stub-auth';

function StatusProbe() {
  const state = useAuthState();
  return <div data-testid="status">{state.status}</div>;
}

describe('useAuthState', () => {
  it('re-renders when the session state changes', () => {
    const { authSystem, setState } = createStubAuth();
    render(
      <AuthContext value={authSystem}>
        <StatusProbe />
      </AuthContext>,
    );
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');

    act(() => setState({ status: 'anonymous' }));

    expect(screen.getByTestId('status')).toHaveTextContent('anonymous');
  });

  it('throws outside AuthContext', () => {
    expect(() => render(<StatusProbe />)).toThrow(
      'useAuthSystem must be used within AuthContext',
    );
  });
});
