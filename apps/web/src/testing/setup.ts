import '@testing-library/jest-dom/vitest';
import { afterAll, afterEach, beforeAll, vi } from 'vitest';

import { server } from '@/testing/mock-api';

vi.mock('@/config/env', () => ({
  env: {
    apiUrl: 'http://localhost:3000', // API_BASE in mock-api.ts
    dev: true,
    fakeAuth: true,
  },
}));

// msw's 'error' strategy only rejects the fetch, which the app may turn into
// an error dialog that the test never looks at; fail the test instead.
const unhandledRequests: string[] = [];

beforeAll(() => {
  server.listen({
    onUnhandledRequest: (request) => {
      unhandledRequests.push(`${request.method} ${request.url}`);
    },
  });
});

afterEach(() => {
  server.resetHandlers();
  const requests = unhandledRequests.splice(0);
  if (requests.length > 0) {
    throw new Error(
      `Unhandled requests (add an MSW handler):\n${requests.join('\n')}`,
    );
  }
});

afterAll(() => {
  server.close();
});
