import { Client } from '@modelcontextprotocol/client';
import { InMemoryTransport, McpServer } from '@modelcontextprotocol/server';
import { InternalServerErrorException, Logger } from '@nestjs/common';
import { z } from 'zod';

import { defineTool } from '@/app/mcp/mcp-tool.config';

import type { McpToolDefinition } from '@/app/mcp/mcp-tool.types';

const input = z.strictObject({ name: z.string().min(1) });
const output = z.strictObject({ greeting: z.string() });
const opaqueOutput = z.strictObject({ value: z.unknown() });
const sparseOutput: unknown[] = [];
sparseOutput.length = 1;
const settings = {
  name: 'greet',
  title: 'Greet',
  description: 'Return a greeting.',
  input,
  output,
  annotations: { readOnlyHint: true, openWorldHint: false },
};
const invocation = {
  caller: { sub: 'verified-caller' },
  requestId: 'tool-request-id',
  signal: new AbortController().signal,
};

async function connect(tool: McpToolDefinition) {
  const server = new McpServer(
    { name: 'test', version: '1.0.0' },
    {
      capabilities: { tools: { listChanged: false } },
    },
  );
  tool.validateSchemas();
  tool.register(server, invocation);
  const client = new Client({ name: 'test-client', version: '1.0.0' });
  const [clientTransport, serverTransport] =
    InMemoryTransport.createLinkedPair();
  await server.connect(serverTransport);
  await client.connect(clientTransport);
  return {
    client,
    close: async () => {
      await client.close();
      await server.close();
    },
  };
}

describe('typed MCP tools', () => {
  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'log').mockImplementation(vi.fn());
    vi.spyOn(Logger.prototype, 'error').mockImplementation(vi.fn());
  });

  afterEach(() => vi.restoreAllMocks());

  it('infers input types, passes caller context and returns equivalent JSON representations', async () => {
    const handler = vi.fn((value: z.output<typeof input>) => ({
      greeting: `Hello ${value.name}`,
    }));
    const connection = await connect(defineTool({ ...settings, handler }));
    try {
      const result = await connection.client.callTool({
        name: 'greet',
        arguments: { name: 'reader' },
      });
      expect(result).toMatchObject({
        structuredContent: { greeting: 'Hello reader' },
        content: [{ type: 'text', text: '{"greeting":"Hello reader"}' }],
      });
      expect(handler).toHaveBeenCalledWith({ name: 'reader' }, invocation);
      expect(connection.client.getServerCapabilities()).toMatchObject({
        tools: { listChanged: false },
      });
    } finally {
      await connection.close();
    }
  });

  it('rejects invalid arguments before invoking application behavior', async () => {
    const handler = vi.fn(() => ({ greeting: 'hello' }));
    const connection = await connect(defineTool({ ...settings, handler }));
    try {
      const result = await connection.client.callTool({
        name: 'greet',
        arguments: { name: '', unknown: true },
      });
      expect(result).toMatchObject({ isError: true });
      expect(JSON.stringify(result)).toContain('name');
      expect(handler).not.toHaveBeenCalled();
      expect(Logger.prototype.log).toHaveBeenCalledWith(
        expect.objectContaining({
          tool: 'greet',
          outcome: 'invalid_input',
          requestId: 'tool-request-id',
        }),
      );
    } finally {
      await connection.close();
    }
  });

  it('keeps unknown tool calls as protocol errors', async () => {
    const connection = await connect(
      defineTool({ ...settings, handler: () => ({ greeting: 'hello' }) }),
    );
    try {
      await expect(
        connection.client.callTool({ name: 'unknown', arguments: {} }),
      ).rejects.toMatchObject({ code: -32_602 });
    } finally {
      await connection.close();
    }
  });

  it('rejects incompatible handler argument and result types at compile time', () => {
    const wrongArgument = defineTool({
      ...settings,
      // @ts-expect-error -- the schema accepts a string name, never a number.
      handler: (_value: { name: number }) => ({ greeting: 'hello' }),
    });
    const wrongResult = defineTool({
      ...settings,
      // @ts-expect-error -- the result schema requires a string greeting.
      handler: () => ({ greeting: 123 }),
    });
    expect([wrongArgument.name, wrongResult.name]).toEqual(['greet', 'greet']);
  });

  it('redacts unexpected HTTP failures with server diagnostics and a request identifier', async () => {
    const connection = await connect(
      defineTool({
        ...settings,
        handler: () => {
          throw new InternalServerErrorException('private SELECT query');
        },
      }),
    );
    try {
      const result = await connection.client.callTool({
        name: 'greet',
        arguments: { name: 'reader' },
      });
      expect(result).toMatchObject({ isError: true });
      expect(JSON.stringify(result)).toContain('tool-request-id');
      expect(JSON.stringify(result)).not.toContain('SELECT');
      expect(Logger.prototype.error).toHaveBeenCalled();
    } finally {
      await connection.close();
    }
  });

  it('redacts output-schema failures before the SDK can expose their details', async () => {
    const tool = defineTool({
      ...settings,
      // @ts-expect-error -- simulates an untyped dependency returning invalid output.
      handler: () => ({ greeting: 123 }),
    });
    const connection = await connect(tool);
    try {
      const result = await connection.client.callTool({
        name: 'greet',
        arguments: { name: 'reader' },
      });
      expect(result).toMatchObject({ isError: true });
      expect(JSON.stringify(result)).toContain('tool-request-id');
      expect(JSON.stringify(result)).not.toContain('123');
      expect(JSON.stringify(result)).not.toContain('Zod');
    } finally {
      await connection.close();
    }
  });

  it('preserves self-contained references including escaped definition names', async () => {
    const nestedOutput = z.strictObject({
      value: z.strictObject({ label: z.string() }),
    });
    const schema = {
      type: 'object',
      required: ['value'],
      additionalProperties: false,
      properties: { value: { $ref: '#/$defs/a~1b~0c' } },
      $defs: {
        'a/b~c': {
          type: 'object',
          properties: { label: { type: 'string' } },
          required: ['label'],
          additionalProperties: false,
        },
      },
    };
    vi.spyOn(nestedOutput['~standard'].jsonSchema, 'output').mockReturnValue(
      schema,
    );
    const connection = await connect(
      defineTool({
        ...settings,
        output: nestedOutput,
        handler: () => ({ value: { label: 'preserved' } }),
      }),
    );
    try {
      const list = await connection.client.listTools();
      expect(list.tools[0]?.outputSchema).toEqual(schema);
      const result = await connection.client.callTool({
        name: 'greet',
        arguments: { name: 'reader' },
      });
      expect(result).toMatchObject({
        structuredContent: { value: { label: 'preserved' } },
      });
    } finally {
      await connection.close();
    }
  });

  it('rejects unsupported schemas at startup', () => {
    const tool = defineTool({
      ...settings,
      output: z.strictObject({ date: z.date() }),
      handler: () => ({ date: new Date() }),
    });
    expect(() => tool.validateSchemas()).toThrow();
  });

  it.each([
    ['undefined', undefined],
    ['function', () => 'private function result'],
    ['infinity', Infinity],
    ['not a number', NaN],
    ['date', new Date('2020-01-01T00:00:00.000Z')],
    ['bigint', 123n],
    ['symbol', Symbol('private value')],
    ['nested undefined', { nested: [undefined] }],
    ['nested function', { nested: { value: () => 'private nested function' } }],
    ['nested non-finite number', { nested: [-Infinity] }],
    ['sparse array', sparseOutput],
  ])(
    'returns a safe tool error for non-JSON output: %s',
    async (_label, value) => {
      const connection = await connect(
        defineTool({
          ...settings,
          output: opaqueOutput,
          handler: () => ({ value }),
        }),
      );
      try {
        const catalog = await connection.client.listTools();
        const advertised = catalog.tools.find((tool) => tool.name === 'greet');
        if (!advertised) throw new Error('Expected advertised tool definition');
        expect(advertised.outputSchema).toHaveProperty('required', ['value']);
        const result = await connection.client.callTool(
          { name: 'greet', arguments: { name: 'reader' } },
          { toolDefinition: advertised },
        );
        expect(result).toMatchObject({
          isError: true,
          content: [
            {
              type: 'text',
              text: 'The tool could not be completed. Request ID: tool-request-id',
            },
          ],
        });
        expect(result).not.toHaveProperty('structuredContent');
        expect(Logger.prototype.error).toHaveBeenCalled();
      } finally {
        await connection.close();
      }
    },
  );

  it.each([
    null,
    true,
    0,
    'a string',
    [],
    { nested: { values: [null, false, 1.5, 'JSON'] } },
  ])('preserves valid JSON in an opaque result field: %j', async (value) => {
    const connection = await connect(
      defineTool({
        ...settings,
        output: opaqueOutput,
        handler: () => ({ value }),
      }),
    );
    try {
      const catalog = await connection.client.listTools();
      const advertised = catalog.tools.find((tool) => tool.name === 'greet');
      if (!advertised) throw new Error('Expected advertised tool definition');
      const result = await connection.client.callTool(
        { name: 'greet', arguments: { name: 'reader' } },
        { toolDefinition: advertised },
      );
      expect(result).toMatchObject({
        structuredContent: { value },
        content: [{ type: 'text', text: JSON.stringify({ value }) }],
      });
      expect(result.isError).not.toBe(true);
    } finally {
      await connection.close();
    }
  });
});
