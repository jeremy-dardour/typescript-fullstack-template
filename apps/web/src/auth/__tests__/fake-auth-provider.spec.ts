import { describe, expect, it, vi } from 'vitest';

import { FakeAuthProvider } from '@/auth/fake-auth-provider';

describe('fakeAuthProvider', () => {
  it('starts authenticated as the development user', () => {
    const state = new FakeAuthProvider().getState();

    expect(state).toMatchObject({
      status: 'authenticated',
      user: { sub: 'mock-user', name: 'DevUser' },
    });
  });

  it('notifies subscribers and becomes anonymous on sign-out', () => {
    const provider = new FakeAuthProvider();
    const listener = vi.fn();
    provider.subscribe(listener);

    provider.signOut();

    expect(listener).toHaveBeenCalledOnce();
    expect(provider.getState().status).toBe('anonymous');
  });

  it('returns the same state reference until the state changes', () => {
    const provider = new FakeAuthProvider();

    expect(provider.getState()).toBe(provider.getState());
  });

  it('mints a JWT only while authenticated', async () => {
    const provider = new FakeAuthProvider();
    const token = await provider.getAccessToken();
    expect(token.split('.')).toHaveLength(3);

    provider.signOut();

    await expect(provider.getAccessToken()).rejects.toThrow(
      '[FakeAuthProvider] User is not authenticated',
    );
  });
});
