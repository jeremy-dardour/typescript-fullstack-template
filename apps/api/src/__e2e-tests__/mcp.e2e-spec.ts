import { randomUUID } from 'node:crypto';

import { MikroORM } from '@mikro-orm/postgresql';
import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { Client as LegacyClient } from '@modelcontextprotocol/sdk-v1/client/index.js';
import { StreamableHTTPClientTransport as LegacyTransport } from '@modelcontextprotocol/sdk-v1/client/streamableHttp.js';
import { Test } from '@nestjs/testing';
import { firstValueFrom, Subject } from 'rxjs';
import request from 'supertest';
import { z } from 'zod';

import { createTestApp } from '@/__e2e-tests__/helpers/create-app.helper';
import { MockTokenFactory } from '@/__e2e-tests__/helpers/mock-token.factory';
import { MockOidcService } from '@/__e2e-tests__/mocks/mock-oidc.service';
import { OidcDiscoveryService } from '@/app/auth';
import { configureHttpApplication } from '@/app/config';
import { MCP_REQUEST_TIMEOUT } from '@/app/mcp/mcp.config';
import { AppModule } from '@/app.module';
import { Item } from '@/database/entities/item.entity';
import {
  itemPageSchema,
  itemSchema,
} from '@/modules/item/dtos/output/item.dto';
import { ItemService } from '@/modules/item/item.service';

import type { INestApplication } from '@nestjs/common';
import type { NestExpressApplication } from '@nestjs/platform-express';

const VERSIONS = ['2026-07-28', '2025-11-25', '2025-06-18', '2025-03-26'];
const EXPECTED_TOOLS = [
  'create_item',
  'delete_item',
  'get_item',
  'list_items',
  'update_item',
];
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
  let tokenFactory: MockTokenFactory;
  let item: z.infer<typeof itemSchema>;
  const createdIds = new Set<string>();

  beforeAll(async () => {
    await oidc.setup();
    tokenFactory = new MockTokenFactory(
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
    createdIds.add(item.id);
  });

  afterAll(async () => {
    if (createdIds.size > 0)
      await app
        .get(MikroORM)
        .em.fork()
        .nativeDelete(Item, { id: { $in: [...createdIds] } });
    await app?.close();
  });

  async function connect(version: string) {
    const callerToken = await tokenFactory.createToken({
      sub: `mcp-${randomUUID()}`,
    });
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
        requestInit: { headers: { Authorization: `Bearer ${callerToken}` } },
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
        expect(catalog.tools.map((tool) => tool.name)).toEqual(EXPECTED_TOOLS);
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
      expect(catalog.tools.map((tool) => tool.name)).toEqual(EXPECTED_TOOLS);
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

  it.each([undefined, null, 'A description'])(
    'creates Items with aligned description semantics: %j',
    async (description) => {
      const client = await connect('2026-07-28');
      try {
        const result = resultSchema.parse(
          await client.callTool({
            name: 'create_item',
            arguments: {
              name: '  Created through MCP  ',
              ...(description !== undefined && { description }),
            },
          }),
        );
        const created = itemSchema.parse(result.structuredContent);
        createdIds.add(created.id);
        expect(created.name).toBe('  Created through MCP  ');
        expect(created.description).toBe(description ?? null);
        expect(result.content[0]?.text).toBe(
          JSON.stringify(result.structuredContent),
        );
        const rest = await request(app.getHttpServer() as never)
          .get(`/api/items/${created.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        expect(itemSchema.parse(rest.body)).toEqual(created);
      } finally {
        await client.close();
      }
    },
  );

  it.each([
    { name: '' },
    { name: ' '.repeat(3) },
    { name: 'x'.repeat(256) },
    { name: null },
    { name: 'Valid', unknown: 'field' },
  ])(
    'rejects create arguments before application behavior: %j',
    async (arguments_) => {
      const client = await connect('2026-07-28');
      const create = vi.spyOn(app.get(ItemService), 'create');
      try {
        expect(
          await client.callTool({ name: 'create_item', arguments: arguments_ }),
        ).toMatchObject({ isError: true });
        expect(create).not.toHaveBeenCalled();
      } finally {
        create.mockRestore();
        await client.close();
      }
    },
  );

  it('keeps unexpected create failures private', async () => {
    const client = await connect('2026-07-28');
    const create = vi
      .spyOn(app.get(ItemService), 'create')
      .mockRejectedValueOnce(new Error('private SELECT statement'));
    try {
      const result = await client.callTool({
        name: 'create_item',
        arguments: { name: 'Failed create' },
      });
      expect(result).toMatchObject({ isError: true });
      expect(JSON.stringify(result)).not.toContain('SELECT');
      expect(JSON.stringify(result)).toContain('Request ID:');
    } finally {
      create.mockRestore();
      await client.close();
    }
  });

  it.each(['deadline', 'disconnect'])(
    'does not mistake a %s for rollback of a delayed write',
    async (mode) => {
      const module = await Test.createTestingModule({ imports: [AppModule] })
        .overrideProvider(OidcDiscoveryService)
        .useValue(oidc)
        .overrideProvider(MCP_REQUEST_TIMEOUT)
        .useValue(mode === 'deadline' ? 30 : 15_000)
        .compile();
      const delayedApp = module.createNestApplication<NestExpressApplication>({
        bodyParser: false,
        logger: false,
      });
      configureHttpApplication(delayedApp);
      await delayedApp.listen(0, '127.0.0.1');
      const service = delayedApp.get(ItemService);
      const originalCreate = service.create.bind(service);
      const gate = new Subject<void>();
      const entered = new Subject<void>();
      const finished = new Subject<string>();
      const mayWrite = firstValueFrom(gate);
      const invocationEntered = firstValueFrom(entered);
      const writeFinished = firstValueFrom(finished);
      const create = vi
        .spyOn(service, 'create')
        .mockImplementationOnce(async (input) => {
          entered.next();
          await mayWrite;
          const entity = await originalCreate(input);
          finished.next(entity.id);
          return entity;
        });
      const client = new Client(
        { name: 'delayed-client', version: '1.0.0' },
        { versionNegotiation: { mode: { pin: '2026-07-28' } } },
      );
      const controller = new AbortController();
      try {
        const address = await delayedApp.getUrl();
        await client.connect(
          new StreamableHTTPClientTransport(new URL(`${address}/mcp`), {
            requestInit: { headers: { Authorization: `Bearer ${token}` } },
          }),
        );
        const pending = client.callTool(
          { name: 'create_item', arguments: { name: 'Delayed MCP create' } },
          { signal: controller.signal },
        );
        await invocationEntered;
        if (mode === 'disconnect') controller.abort();
        if (mode === 'deadline') {
          await expect(pending).rejects.toMatchObject({ status: 408 });
        } else {
          await expect(pending).rejects.toThrow();
        }
        gate.next();
        const id = await writeFinished;
        createdIds.add(id);
        const rest = await request(app.getHttpServer() as never)
          .get(`/api/items/${id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        expect(itemSchema.parse(rest.body).name).toBe('Delayed MCP create');
      } finally {
        gate.next();
        create.mockRestore();
        await client.close();
        await delayedApp.close();
      }
    },
  );

  it('updates names, preserves omissions and clears descriptions through shared behavior', async () => {
    const client = await connect('2026-07-28');
    try {
      const initial = itemSchema.parse(
        resultSchema.parse(
          await client.callTool({
            name: 'create_item',
            arguments: { name: 'Original name', description: 'Keep me' },
          }),
        ).structuredContent,
      );
      createdIds.add(initial.id);
      const updatedResult = resultSchema.parse(
        await client.callTool({
          name: 'update_item',
          arguments: { id: initial.id, name: '  Renamed  ' },
        }),
      );
      const updated = itemSchema.parse(updatedResult.structuredContent);
      expect(updated).toMatchObject({
        id: initial.id,
        name: '  Renamed  ',
        description: 'Keep me',
      });
      expect(updatedResult.content[0]?.text).toBe(
        JSON.stringify(updatedResult.structuredContent),
      );
      const repeated = itemSchema.parse(
        resultSchema.parse(
          await client.callTool({
            name: 'update_item',
            arguments: { id: initial.id, name: '  Renamed  ' },
          }),
        ).structuredContent,
      );
      expect(repeated).toMatchObject({
        name: '  Renamed  ',
        description: 'Keep me',
      });
      const cleared = itemSchema.parse(
        resultSchema.parse(
          await client.callTool({
            name: 'update_item',
            arguments: { id: initial.id, description: null },
          }),
        ).structuredContent,
      );
      expect(cleared.description).toBeNull();
      const rest = await request(app.getHttpServer() as never)
        .get(`/api/items/${initial.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(itemSchema.parse(rest.body)).toEqual(cleared);
    } finally {
      await client.close();
    }
  });

  it.each([
    { name: null },
    { name: '' },
    { name: '\t ' },
    { name: 'x'.repeat(256) },
    { unexpected: true },
  ])(
    'rejects invalid update arguments and preserves the record: %j',
    async (changes) => {
      const client = await connect('2026-07-28');
      const update = vi.spyOn(app.get(ItemService), 'update');
      try {
        const result = await client.callTool({
          name: 'update_item',
          arguments: { id: item.id, ...changes },
        });
        expect(result).toMatchObject({ isError: true });
        expect(update).not.toHaveBeenCalled();
        const rest = await request(app.getHttpServer() as never)
          .get(`/api/items/${item.id}`)
          .set('Authorization', `Bearer ${token}`)
          .expect(200);
        expect(itemSchema.parse(rest.body)).toEqual(item);
      } finally {
        update.mockRestore();
        await client.close();
      }
    },
  );

  async function lifecycle(client: {
    callTool(parameters: {
      name: string;
      arguments?: Record<string, unknown>;
    }): Promise<unknown>;
  }) {
    const createdResult = resultSchema.parse(
      await client.callTool({
        name: 'create_item',
        arguments: { name: 'MCP lifecycle', description: 'Original' },
      }),
    );
    const created = itemSchema.parse(createdResult.structuredContent);
    createdIds.add(created.id);
    expect(createdResult.content[0]?.text).toBe(JSON.stringify(created));
    const rest = await request(app.getHttpServer() as never)
      .get(`/api/items/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    expect(itemSchema.parse(rest.body)).toEqual(created);
    const read = resultSchema.parse(
      await client.callTool({
        name: 'get_item',
        arguments: { id: created.id },
      }),
    );
    expect(itemSchema.parse(read.structuredContent)).toEqual(created);
    expect(read.content[0]?.text).toBe(JSON.stringify(read.structuredContent));
    const list = resultSchema.parse(
      await client.callTool({
        name: 'list_items',
        arguments: { page_size: 100 },
      }),
    );
    const page = itemPageSchema.parse(list.structuredContent);
    expect(page.data.some((entry) => entry.id === created.id)).toBe(true);
    expect(list.content[0]?.text).toBe(JSON.stringify(list.structuredContent));
    const updated = resultSchema.parse(
      await client.callTool({
        name: 'update_item',
        arguments: { id: created.id, name: 'Changed through MCP' },
      }),
    );
    expect(itemSchema.parse(updated.structuredContent)).toMatchObject({
      name: 'Changed through MCP',
      description: 'Original',
    });
    expect(updated.content[0]?.text).toBe(
      JSON.stringify(updated.structuredContent),
    );
    const cleared = resultSchema.parse(
      await client.callTool({
        name: 'update_item',
        arguments: { id: created.id, description: null },
      }),
    );
    expect(itemSchema.parse(cleared.structuredContent).description).toBeNull();
    expect(cleared.content[0]?.text).toBe(
      JSON.stringify(cleared.structuredContent),
    );
    const deleted = resultSchema.parse(
      await client.callTool({
        name: 'delete_item',
        arguments: { id: created.id },
      }),
    );
    expect(deleted.structuredContent).toEqual({
      id: created.id,
      deleted: true,
    });
    expect(deleted.content[0]?.text).toBe(
      JSON.stringify(deleted.structuredContent),
    );
    expect(
      await client.callTool({
        name: 'get_item',
        arguments: { id: created.id },
      }),
    ).toMatchObject({ isError: true });
    expect(
      await client.callTool({
        name: 'delete_item',
        arguments: { id: created.id },
      }),
    ).toMatchObject({ isError: true });
    const absent = await request(app.getHttpServer() as never)
      .get(`/api/items/${created.id}`)
      .set('Authorization', `Bearer ${token}`)
      .expect(404);
    expect(absent.status).toBe(404);
  }

  it.each(VERSIONS)(
    'completes the entire Item lifecycle on %s',
    async (version) => {
      const client = await connect(version);
      try {
        await lifecycle(client);
      } finally {
        await client.close();
      }
    },
  );

  it('completes the entire Item lifecycle through a real v1 SDK', async () => {
    const client = new LegacyClient({
      name: 'legacy-lifecycle',
      version: '1.0.0',
    });
    try {
      await client.connect(
        new LegacyTransport(new URL(`${baseUrl}/mcp`), {
          requestInit: { headers: { Authorization: `Bearer ${token}` } },
        }),
      );
      await lifecycle(client);
    } finally {
      await client.close();
    }
  });

  it('advertises only the fixed five tools with their intended safety annotations', async () => {
    const client = await connect('2026-07-28');
    try {
      const catalog = await client.listTools();
      expect(catalog.tools.map((tool) => tool.name)).toEqual(EXPECTED_TOOLS);
      for (const tool of catalog.tools) {
        expect(tool.inputSchema).toHaveProperty('type', 'object');
        expect(tool.outputSchema).toHaveProperty('type', 'object');
        expect(tool.annotations).toHaveProperty('openWorldHint', false);
        if (['get_item', 'list_items'].includes(tool.name)) {
          expect(tool.annotations).toHaveProperty('readOnlyHint', true);
          expect(tool.annotations).not.toHaveProperty('destructiveHint');
        } else {
          expect(tool.annotations).toMatchObject({
            readOnlyHint: false,
            destructiveHint: tool.name !== 'create_item',
            idempotentHint: tool.name !== 'create_item',
          });
        }
      }
    } finally {
      await client.close();
    }
  });
});
