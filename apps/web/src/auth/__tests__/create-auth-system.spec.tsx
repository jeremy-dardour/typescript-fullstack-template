import { describe, expect, it, vi } from 'vitest';

import { env } from '@/config/env';

const { createAuthSystem } = await import('@/auth/create-auth-system');

describe('createAuthSystem', () => {
  it('uses the fake session when VITE_FAKE_AUTH is on', () => {
    expect(createAuthSystem().session.getState().status).toBe('authenticated');
  });

  it('refuses to start without an adapter when fake auth is off', () => {
    vi.spyOn(env, 'fakeAuth', 'get').mockReturnValue(false);

    expect(() => createAuthSystem()).toThrow(/No auth adapter configured/);
  });
});
