import { Injectable, Scope } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { z } from 'zod';

import { McpCatalogService } from '@/app/mcp/mcp-catalog.service';
import { McpToolProvider } from '@/app/mcp/mcp-tool-provider.decorator';
import { defineTool } from '@/app/mcp/mcp-tool.config';

import type { McpToolProviderContract } from '@/app/mcp/mcp-tool.types';
import type { Provider } from '@nestjs/common';

function toolsProvider(name: string) {
  @McpToolProvider()
  class FeatureTools implements McpToolProviderContract {
    readonly instructions = 'Feature instructions';

    getTools() {
      return [
        defineTool({
          name,
          title: name,
          description: 'Test tool',
          input: z.strictObject({}),
          output: z.strictObject({ value: z.string() }),
          annotations: { readOnlyHint: true },
          handler: () => ({ value: 'test' }),
        }),
      ];
    }
  }
  return FeatureTools;
}

async function catalogModule(providers: Provider[]) {
  return Test.createTestingModule({
    imports: [DiscoveryModule],
    providers: [McpCatalogService, ...providers],
  }).compile();
}

describe('mCP feature catalog', () => {
  it('discovers marked feature providers without a central feature import', async () => {
    const module = await catalogModule([toolsProvider('feature_tool')]);
    try {
      await module.init();
      expect(module.get(McpCatalogService).hasTools).toBe(true);
      expect(module.get(McpCatalogService).instructions).toBe(
        'Feature instructions',
      );
    } finally {
      await module.close();
    }
  });

  it('fails startup on duplicate names from different providers', async () => {
    const module = await catalogModule([
      toolsProvider('duplicate'),
      toolsProvider('duplicate'),
    ]);
    try {
      await expect(module.init()).rejects.toThrow(
        'Duplicate MCP tool name: duplicate',
      );
    } finally {
      await module.close();
    }
  });

  it('fails startup on invalid names', async () => {
    const module = await catalogModule([toolsProvider('invalid tool name')]);
    try {
      await expect(module.init()).rejects.toThrow(
        'Invalid MCP tool name: invalid tool name',
      );
    } finally {
      await module.close();
    }
  });

  it('rejects providers with request-scoped dependencies', async () => {
    @Injectable({ scope: Scope.REQUEST })
    class RequestDependency {}

    @McpToolProvider()
    class InvalidProvider implements McpToolProviderContract {
      constructor(readonly dependency: RequestDependency) {}
      getTools() {
        return [];
      }
    }

    const module = await catalogModule([RequestDependency, InvalidProvider]);
    try {
      await expect(module.init()).rejects.toThrow(
        'must use singleton-compatible dependencies',
      );
    } finally {
      await module.close();
    }
  });

  it('rejects marked classes without the provider contract at startup', async () => {
    @McpToolProvider()
    class InvalidProvider {}

    const module = await catalogModule([InvalidProvider]);
    try {
      await expect(module.init()).rejects.toThrow('must implement getTools()');
    } finally {
      await module.close();
    }
  });
});
