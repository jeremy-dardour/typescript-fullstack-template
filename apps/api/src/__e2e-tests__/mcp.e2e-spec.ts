import { MikroORM } from '@mikro-orm/postgresql';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { Client as LegacyClient } from '@modelcontextprotocol/sdk-v1/client/index.js';
import { StreamableHTTPClientTransport as LegacyTransport } from '@modelcontextprotocol/sdk-v1/client/streamableHttp.js';
import request from 'supertest';
import { z } from 'zod';

import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';
import { MockTokenFactory } from '@/__e2e-tests__/helpers/mock-token.factory';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';
import { Item } from '@/database/entities/item.entity';
import {
  itemPageSchema,
  itemSchema,
} from '@/modules/item/dtos/output/item.dto';

import type { INestApplication } from '@nestjs/common';

const VERSIONS = ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26'];
const textContentSchema = z.object({
  type: z.literal('text'),
  text: z.string(),
});
const resultSchema = z.object({
  structuredContent: z.unknown(),
  content: z.array(textContentSchema),
});

describe('MCP Item tools with PostgreSQL', () => {
  const oidc = new MockOidcService();
  let app: INestApplication;
  let baseUrl: string;
  let token: string;
  let item: z.infer<typeof itemSchema>;

  beforeAll(async () => {
    await oidc.setup();
    const tokenFactory = new MockTokenFactory(
      oidc,
      'e2e-test-client-id',
      process.env.AUTH_ACCEPTED_SCOPES!,
    );
    token = await tokenFactory.validToken();
    app = await createTestApp({ oidcOverride: oidc });
    await app.listen(0, '127.0.0.1');
    baseUrl = await app.getUrl();
    const response = await request(app.getHttpServer() as never)
      .post('/api/items')
      .set('Authorization', `Bearer ${token}`)
      .send({ name: 'MCP read fixture', description: 'Created through REST' })
      .expect(201);
    item = itemSchema.parse(response.body);
  });

  afterAll(async () => {
    if (item)
      await app.get(MikroORM).em.fork().nativeDelete(Item, { id: item.id });
    await app?.close();
  });

  async function connect(version: string) {
    const client = new Client(
      { name: 'template-e2e', version: '1.0.0' },
      {
        supportedProtocolVersions: [version],
        versionNegotiation:
          version === '2026-07-28'
            ? { mode: { pin: version } }
            : { mode: 'legacy' },
      },
    );
    await client.connect(
      new StreamableHTTPClientTransport(new URL(`${baseUrl}/mcp`), {
        requestInit: { headers: { Authorization: `Bearer ${token}` } },
      }),
    );
    return client;
  }

  it.each(VERSIONS)(
    'lists and reads the same records as REST on %s',
    async (version) => {
      const client = await connect(version);
      try {
        const catalog = await client.listTools();
        expect(catalog.tools.map((tool) => tool.name)).toEqual([
          'get_item',
          'list_items',
        ]);
        expect(client.getServerCapabilities()).toMatchObject({
          tools: { listChanged: false },
        });

        const result = resultSchema.parse(
          await client.callTool({
            name: 'get_item',
            arguments: { id: item.id },
          }),
        );
        expect(itemSchema.parse(result.structuredContent)).toEqual(item);
        expect(result.content[0]?.text).toBe(
          JSON.stringify(result.structuredContent),
        );

        const page = resultSchema.parse(
          await client.callTool({
            name: 'list_items',
            arguments: { page: 1, page_size: 5 },
          }),
        );
        const mcpPage = itemPageSchema.parse(page.structuredContent);
        const rest = await request(app.getHttpServer() as never)
          .get('/api/items?page=1&page_size=5')
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        expect(mcpPage).toEqual(itemPageSchema.parse(rest.body));
        expect(page.content[0]?.text).toBe(
          JSON.stringify(page.structuredContent),
        );
      } finally {
        await client.close();
      }
    },
  );

  it('rejects invalid identifiers and pagination as tool errors', async () => {
    const client = await connect('2026-07-28');
    try {
      expect(
        await client.callTool({
          name: 'get_item',
          arguments: { id: 'not-a-uuid' },
        }),
      ).toMatchObject({ isError: true });
      expect(
        await client.callTool({
          name: 'list_items',
          arguments: { page_size: 101 },
        }),
      ).toMatchObject({ isError: true });
      expect(
        await client.callTool({
          name: 'list_items',
          arguments: { unknown: true },
        }),
      ).toMatchObject({ isError: true });
      const missing = await client.callTool({
        name: 'get_item',
        arguments: { id: '00000000-0000-4000-8000-000000000000' },
      });
      expect(missing).toMatchObject({
        isError: true,
        content: [{ type: 'text', text: 'Resource not found' }],
      });
    } finally {
      await client.close();
    }
  });

  it('serves a real v1 SDK client through legacy initialization', async () => {
    const client = new LegacyClient({ name: 'legacy-e2e', version: '1.0.0' });
    try {
      await client.connect(
        new LegacyTransport(new URL(`${baseUrl}/mcp`), {
          requestInit: { headers: { Authorization: `Bearer ${token}` } },
        }),
      );
      const catalog = await client.listTools();
      expect(catalog.tools.map((tool) => tool.name)).toEqual([
        'get_item',
        'list_items',
      ]);
      const result = resultSchema.parse(
        await client.callTool({ name: 'get_item', arguments: { id: item.id } }),
      );
      expect(itemSchema.parse(result.structuredContent)).toEqual(item);
      expect(result.content[0]?.text).toBe(
        JSON.stringify(result.structuredContent),
      );
    } finally {
      await client.close();
    }
  });
});
