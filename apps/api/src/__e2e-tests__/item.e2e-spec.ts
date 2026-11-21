import { MikroORM } from '@mikro-orm/postgresql';
import request from 'supertest';

import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';
import { MockTokenFactory } from '@/__e2e-tests__/helpers/mock-token.factory';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';
import { Item } from '@/database/entities/item.entity';
import {
  itemPageSchema,
  itemSchema,
} from '@/modules/item/dtos/output/item.dto';

import type { INestApplication } from '@nestjs/common';
import type { Test as SuperTestType } from 'supertest';
import type TestAgent from 'supertest/lib/agent';

function createRequest(app: INestApplication): TestAgent<SuperTestType> {
  return request(app.getHttpServer() as never);
}

function paginationLink(header: unknown, relation: string): URL {
  if (typeof header !== 'string') throw new TypeError('Expected a Link header');
  const entry = header
    .split(',')
    .find((link) => link.includes(`rel="${relation}"`));
  const target = entry?.match(/<([^>]+)>/)?.[1];
  if (!target) throw new Error(`Missing pagination link: ${relation}`);
  return new URL(target);
}

describe('Item CRUD E2E Tests', () => {
  const mockOidc = new MockOidcService();
  let tokenFactory: MockTokenFactory;
  let app: INestApplication;
  let token: string;

  beforeAll(async () => {
    // AUTH_CLIENT_ID in .env.e2e: the default expected audience.
    const audience = 'e2e-test-client-id';
    const acceptedScope = process.env.AUTH_ACCEPTED_SCOPES!;

    await mockOidc.setup();
    tokenFactory = new MockTokenFactory(mockOidc, audience, acceptedScope);
    token = await tokenFactory.validToken();

    app = await createTestApp({ oidcOverride: mockOidc });
  });

  afterAll(async () => {
    await app.close();
  });

  let createdItemId: string;

  describe('POST /api/items', () => {
    it('should create an item', async () => {
      const response = await createRequest(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Test Item', description: 'A test item' })
        .expect(201);

      expect(response.body).toMatchObject({
        name: 'Test Item',
        description: 'A test item',
      });
      const body = response.body as {
        id: string;
        createdAt: string;
        updatedAt: string;
      };
      expect(body.id).toBeDefined();
      expect(body.createdAt).toBeDefined();
      expect(body.updatedAt).toBeDefined();

      createdItemId = body.id;
      expect(itemSchema.safeParse(response.body).success).toBe(true);
    });

    it('should reject empty name', async () => {
      await createRequest(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: '', description: 'No name' })
        .expect(422);
    });

    it.each([' '.repeat(3), '\t\n', 'a'.repeat(256), null, 12])(
      'rejects invalid names before persistence: %j',
      async (name) => {
        const response = await createRequest(app)
          .post('/api/items')
          .set('Authorization', `Bearer ${token}`)
          .send({ name })
          .expect(422);

        expect(response.body).toMatchObject({
          status: 422,
          errors: [{ field: 'name', pointer: '/name' }],
        });
      },
    );

    it('rejects unknown fields with an escaped field pointer', async () => {
      const response = await createRequest(app)
        .post('/api/items')
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Item', 'actor~/id': 'client' })
        .expect(422);

      expect(response.body).toMatchObject({
        errors: [
          {
            field: 'actor~/id',
            pointer: '/actor~0~1id',
            code: 'UNKNOWN_FIELD',
          },
        ],
      });
    });

    it.each([{}, { description: null }])(
      'returns a required null description when none is supplied: %j',
      async (description) => {
        const response = await createRequest(app)
          .post('/api/items')
          .set('Authorization', `Bearer ${token}`)
          .send({ name: '  Preserved spacing  ', ...description })
          .expect(201);
        const item = itemSchema.parse(response.body);

        expect(item).toMatchObject({
          name: '  Preserved spacing  ',
          description: null,
        });
        await createRequest(app)
          .delete(`/api/items/${item.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(204);
      },
    );
  });

  describe('GET /api/items', () => {
    it('returns a bounded page with pagination metadata', async () => {
      const response = await createRequest(app)
        .get('/api/items')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      const body = itemPageSchema.parse(response.body);
      expect(body.data.length).toBeGreaterThanOrEqual(1);
      expect(body.data.length).toBeLessThanOrEqual(20);
      expect(body).toMatchObject({ page: 1, page_size: 20 });
      expect(response.headers['x-total-count']).toBe(String(body.total));
      expect(response.headers['x-page-count']).toBe(String(body.total_pages));
    });

    it('breaks creation-time ties by UUID and supplies consistent page links', async () => {
      const em = app.get(MikroORM).em.fork();
      const ids = [
        'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      ];
      const createdAt = new Date('2099-01-01T00:00:00.000Z');
      const items = ids.map((id) =>
        em.create(Item, {
          id,
          name: 'Pagination tie',
          createdAt,
          updatedAt: createdAt,
        }),
      );
      await em.persist(items).flush();

      try {
        const first = await createRequest(app)
          .get('/api/items?page=1&page_size=2')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        const firstPage = itemPageSchema.parse(first.body);
        expect(firstPage.data.map((item) => item.id)).toEqual([ids[2], ids[1]]);
        const next = paginationLink(first.headers.link, 'next');
        expect(next.searchParams.get('page')).toBe('2');
        expect(next.searchParams.get('page_size')).toBe('2');

        const second = await createRequest(app)
          .get('/api/items?page=2&page_size=2')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        const secondPage = itemPageSchema.parse(second.body);
        expect(secondPage.data[0]?.id).toBe(ids[0]);
        expect(secondPage.total).toBe(firstPage.total);
        const previous = paginationLink(second.headers.link, 'prev');
        const self = paginationLink(second.headers.link, 'self');
        expect(previous.searchParams.get('page')).toBe('1');
        expect(previous.searchParams.get('page_size')).toBe('2');
        expect(self.searchParams.get('page')).toBe('2');
        expect(self.searchParams.get('page_size')).toBe('2');
      } finally {
        await em.nativeDelete(Item, { id: { $in: ids } });
      }
    });

    it.each([
      'page=0',
      'page=-1',
      'page=1.5',
      'page=null',
      'page=invalid',
      'page_size=0',
      'page_size=101',
      'unknown=1',
    ])('rejects an invalid pagination query with 400: %s', async (query) => {
      await createRequest(app)
        .get(`/api/items?${query}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(400);
    });

    it('returns an empty data array for a page beyond the collection', async () => {
      const response = await createRequest(app)
        .get('/api/items?page=1000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(itemPageSchema.parse(response.body)).toMatchObject({
        data: [],
        page: 1_000_000,
        page_size: 20,
      });
    });
  });

  describe('GET /api/items/:id', () => {
    it('rejects a malformed UUID with 400 rather than a body-validation status', async () => {
      const response = await createRequest(app)
        .get('/api/items/not-a-uuid')
        .set('Authorization', `Bearer ${token}`)
        .expect(400);

      expect(response.body).toMatchObject({
        errors: [{ field: 'id', pointer: '/id', code: 'INVALID_UUID' }],
      });
    });

    it('should return a single item', async () => {
      const response = await createRequest(app)
        .get(`/api/items/${createdItemId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body).toMatchObject({
        id: createdItemId,
        name: 'Test Item',
      });
    });

    it('should return 404 for non-existent item', async () => {
      const response = await createRequest(app)
        .get('/api/items/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${token}`)
        .expect(404)
        .expect('Content-Type', /application\/problem\+json/);

      // The ORM's message embeds the query filter; it must not reach clients.
      expect(response.body).toMatchObject({
        status: 404,
        title: 'Not Found',
        detail: 'Resource not found',
      });
    });
  });

  describe('PATCH /api/items/:id', () => {
    it.each([{ name: '' }, { name: '  ' }, { actor: 'client' }])(
      'rejects invalid changes without modifying the record: %j',
      async (changes) => {
        await createRequest(app)
          .patch(`/api/items/${createdItemId}`)
          .set('Authorization', `Bearer ${token}`)
          .send(changes)
          .expect(422);

        const response = await createRequest(app)
          .get(`/api/items/${createdItemId}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        expect(response.body).toMatchObject({
          name: 'Test Item',
          description: 'A test item',
        });
      },
    );

    it('should update an item', async () => {
      const response = await createRequest(app)
        .patch(`/api/items/${createdItemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: 'Updated Item' })
        .expect(200);

      expect(response.body).toMatchObject({
        id: createdItemId,
        name: 'Updated Item',
        description: 'A test item',
      });
    });
  });

  describe('PATCH /api/items/:id with null', () => {
    it('rejects null for a non-nullable field instead of reaching the database', async () => {
      await createRequest(app)
        .patch(`/api/items/${createdItemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ name: null })
        .expect(422);
    });

    it('accepts null to clear a nullable field', async () => {
      const response = await createRequest(app)
        .patch(`/api/items/${createdItemId}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ description: null })
        .expect(200);

      expect(response.body).toMatchObject({ description: null });
    });
  });

  describe('DELETE /api/items/:id', () => {
    it('should delete an item', async () => {
      await createRequest(app)
        .delete(`/api/items/${createdItemId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);
    });

    it('should return 404 after deletion', async () => {
      await createRequest(app)
        .get(`/api/items/${createdItemId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });
});
