import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';

import type { Item } from '@/api/hooks/use-items';

/** Must match the apiUrl the test setup gives `@/config/env`. */
export const API_BASE = 'http://localhost:3000';

export const server = setupServer();

/** An RFC 9457 body shaped like the API's ProblemDetailsFilter output. */
export function problemDetails(
  status: number,
  overrides: Partial<{ type: string; title: string; detail: string }> = {},
): Record<string, unknown> {
  return {
    type: 'https://api.example.com/errors/test',
    title: 'Error',
    status,
    detail: 'Something went wrong',
    instance: '/api/test',
    request_id: 'test-request-id',
    timestamp: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

export function problemResponse(
  status: number,
  overrides?: Parameters<typeof problemDetails>[1],
) {
  return HttpResponse.json(problemDetails(status, overrides), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

/**
 * A stateful in-memory stand-in for the items endpoints: tests drive a whole
 * journey (create, list, update, delete) without repeating raw handlers.
 */
export function setupItemsApi(initialItems: Item[] = []) {
  let items = [...initialItems];
  let generatedId = 0;
  let nextError: { status: number; detail: string } | null = null;

  const takeError = () => {
    const error = nextError;
    nextError = null;
    return error;
  };

  server.use(
    http.get(`${API_BASE}/api/items`, () => HttpResponse.json(items)),
    http.post(`${API_BASE}/api/items`, async ({ request }) => {
      const error = takeError();
      if (error) return problemResponse(error.status, { detail: error.detail });

      const input = (await request.json()) as Pick<
        Item,
        'name' | 'description'
      >;
      const now = new Date().toISOString();
      const created: Item = {
        id: `item-${++generatedId}`,
        name: input.name,
        description: input.description ?? null,
        createdAt: now,
        updatedAt: now,
      };
      items = [created, ...items];
      return HttpResponse.json(created, { status: 201 });
    }),
    http.patch(`${API_BASE}/api/items/:id`, async ({ params, request }) => {
      const existing = items.find((item) => item.id === params.id);
      if (!existing)
        return problemResponse(404, { detail: 'Resource not found' });

      const input = (await request.json()) as Partial<Item>;
      const updated = {
        ...existing,
        ...input,
        updatedAt: new Date().toISOString(),
      };
      items = items.map((item) => (item.id === existing.id ? updated : item));
      return HttpResponse.json(updated);
    }),
    http.delete(`${API_BASE}/api/items/:id`, ({ params }) => {
      items = items.filter((item) => item.id !== params.id);
      return new HttpResponse(null, { status: 204 });
    }),
  );

  return {
    getItems: () => items,
    /** The next create answers with this Problem Details error. */
    failNextCreate(status: number, detail: string) {
      nextError = { status, detail };
    },
  };
}
