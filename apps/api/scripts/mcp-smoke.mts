import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

import {
  Client,
  StreamableHTTPClientTransport,
} from '@modelcontextprotocol/client';
import { config } from 'dotenv';
import { z } from 'zod';

config({
  path: fileURLToPath(new URL('../.env', import.meta.url)),
  quiet: true,
});

const settingsSchema = z.object({
  MCP_SMOKE_URL: z.url().optional(),
  MCP_PUBLIC_URL: z.url().optional(),
  MCP_ACCESS_TOKEN: z.string().min(1).optional(),
  FAKE_AUTH: z.string().optional(),
  PORT: z.coerce.number().int().positive().max(65_535).optional(),
});

class SmokeCheckError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SmokeCheckError';
  }
}

async function run(): Promise<void> {
  const settings = settingsSchema.parse(process.env);
  const { values } = parseArgs({
    options: { legacy: { type: 'boolean', default: false } },
  });
  const endpoint =
    settings.MCP_SMOKE_URL ??
    settings.MCP_PUBLIC_URL ??
    (settings.PORT ? `http://localhost:${settings.PORT}/mcp` : undefined);
  if (!endpoint) {
    throw new SmokeCheckError(
      'Configure MCP_SMOKE_URL, MCP_PUBLIC_URL or PORT.',
    );
  }
  const url = new URL(endpoint);
  if (
    !['http:', 'https:'].includes(url.protocol) ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  ) {
    throw new SmokeCheckError(
      'Use an HTTP(S) endpoint without credentials, query or fragment.',
    );
  }
  const headers: Record<string, string> = {};
  if (settings.MCP_ACCESS_TOKEN) {
    headers.Authorization = `Bearer ${settings.MCP_ACCESS_TOKEN}`;
  } else if (settings.FAKE_AUTH?.toLowerCase() !== 'true') {
    throw new SmokeCheckError(
      'Set MCP_ACCESS_TOKEN when the API uses real authentication.',
    );
  }

  const client = new Client(
    { name: 'template-api-smoke', version: '1.0.0' },
    { versionNegotiation: { mode: values.legacy ? 'legacy' : 'auto' } },
  );
  const transport = new StreamableHTTPClientTransport(url, {
    requestInit: { headers },
  });
  const ownedIds = new Set<string>();
  let phase = 'connection';
  let failure: unknown;
  let cleanupDefinition:
    Awaited<ReturnType<Client['listTools']>>['tools'][number] | undefined;
  const cleanupFailures: string[] = [];

  try {
    await client.connect(transport);
    phase = 'tool discovery';
    const catalog = await client.listTools();
    const tools = new Map(catalog.tools.map((tool) => [tool.name, tool]));
    for (const name of [
      'list_items',
      'get_item',
      'create_item',
      'update_item',
      'delete_item',
    ]) {
      if (!tools.has(name))
        throw new SmokeCheckError(`Expected tool ${name} was not advertised.`);
    }
    cleanupDefinition = tools.get('delete_item');

    const call = async (name: string, args: Record<string, unknown>) => {
      phase = name;
      const tool = tools.get(name);
      if (!tool) throw new SmokeCheckError(`Tool ${name} is not available.`);
      const result = await client.callTool(
        { name, arguments: args },
        { toolDefinition: tool },
      );
      if (result.isError)
        throw new SmokeCheckError(`Tool ${name} returned an error result.`);
      const structured = z
        .record(z.string(), z.unknown())
        .parse(result.structuredContent);
      const text = result.content.filter((entry) => entry.type === 'text');
      if (text.length !== 1 || !text[0]) {
        throw new SmokeCheckError(
          `Tool ${name} must return one JSON text result.`,
        );
      }
      const parsedText: unknown = JSON.parse(text[0].text);
      assert.deepEqual(
        parsedText,
        structured,
        `${name}: text and structured output differ`,
      );
      return structured;
    };

    const prefix = `MCP smoke ${randomUUID()}`;
    const created = await call('create_item', {
      name: `${prefix} first`,
      description: 'Created by the MCP smoke command',
    });
    const id = z.uuid().parse(created.id);
    ownedIds.add(id);
    const second = await call('create_item', { name: `${prefix} second` });
    ownedIds.add(z.uuid().parse(second.id));

    const read = await call('get_item', { id });
    assert.equal(read.id, id);
    assert.equal(read.name, created.name);

    const updated = await call('update_item', {
      id,
      name: `${prefix} updated`,
    });
    assert.equal(updated.name, `${prefix} updated`);
    assert.equal(updated.description, created.description);
    const cleared = await call('update_item', { id, description: null });
    assert.equal(cleared.description, null);

    for (const page of [1, 2]) {
      const list = await call('list_items', { page, page_size: 1 });
      assert.equal(list.page, page);
      assert.equal(list.page_size, 1);
      assert.ok(
        Array.isArray(list.data) && list.data.length === 1,
        'Expected a bounded Item page',
      );
    }

    const deleted = await call('delete_item', { id });
    assert.equal(deleted.id, id);
    assert.equal(deleted.deleted, true);
    ownedIds.delete(id);
    phase = 'read after deletion';
    const absent = await client.callTool(
      { name: 'get_item', arguments: { id } },
      { toolDefinition: tools.get('get_item') },
    );
    assert.equal(
      absent.isError,
      true,
      'A deleted Item must produce a tool error',
    );
  } catch (error) {
    failure = error;
  } finally {
    for (const id of ownedIds) {
      try {
        const result = await client.callTool(
          { name: 'delete_item', arguments: { id } },
          { toolDefinition: cleanupDefinition },
        );
        const deleted = z
          .record(z.string(), z.unknown())
          .safeParse(result.structuredContent);
        if (
          result.isError ||
          !deleted.success ||
          deleted.data.id !== id ||
          deleted.data.deleted !== true
        ) {
          cleanupFailures.push(id);
        }
      } catch {
        cleanupFailures.push(id);
      }
    }
    try {
      await client.close();
    } catch (error) {
      failure ??= error;
      phase = 'connection cleanup';
    }
  }

  if (cleanupFailures.length > 0) {
    console.error(
      `MCP smoke cleanup failed for owned Item IDs: ${cleanupFailures.join(', ')}`,
    );
    process.exitCode = 1;
  }
  if (failure) {
    const detail =
      failure instanceof SmokeCheckError
        ? failure.message
        : 'The client request or result assertion failed; inspect API logs for details.';
    console.error(`MCP smoke failed during ${phase}: ${detail}`);
    process.exitCode = 1;
  } else if (cleanupFailures.length === 0) {
    console.log(
      `MCP smoke: OK (${values.legacy ? 'legacy initialization' : 'automatic protocol negotiation'}; five tools, pagination, CRUD and cleanup)`,
    );
  }
}

try {
  await run();
} catch (error) {
  console.error(
    error instanceof SmokeCheckError
      ? error.message
      : 'MCP smoke configuration failed. Check endpoint and authentication settings.',
  );
  process.exitCode = 1;
}
