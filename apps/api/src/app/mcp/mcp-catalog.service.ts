import { Injectable, Scope } from '@nestjs/common';
import { DiscoveryService, Reflector } from '@nestjs/core';

import { MCP_TOOL_PROVIDER } from '@/app/mcp/mcp-tool-provider.decorator';

import type {
  McpInvocation,
  McpToolDefinition,
  McpToolProviderContract,
} from '@/app/mcp/mcp-tool.types';
import type { McpServer } from '@modelcontextprotocol/server';
import type { OnApplicationBootstrap } from '@nestjs/common';

function isToolProvider(value: unknown): value is McpToolProviderContract {
  return (
    typeof value === 'object' &&
    value !== null &&
    'getTools' in value &&
    typeof value.getTools === 'function'
  );
}

@Injectable()
export class McpCatalogService implements OnApplicationBootstrap {
  private tools: readonly McpToolDefinition[] = [];
  private featureInstructions: string[] = [];

  constructor(
    private readonly discovery: DiscoveryService,
    private readonly reflector: Reflector,
  ) {}

  get hasTools(): boolean {
    return this.tools.length > 0;
  }

  get instructions(): string {
    return this.featureInstructions.join('\n\n');
  }

  onApplicationBootstrap(): void {
    const catalog: McpToolDefinition[] = [];
    const names = new Set<string>();
    const instructions: string[] = [];
    for (const provider of this.discovery.getProviders()) {
      if (
        !provider.metatype ||
        !this.reflector.get<boolean>(MCP_TOOL_PROVIDER, provider.metatype)
      )
        continue;
      if (
        (provider.scope !== undefined && provider.scope !== Scope.DEFAULT) ||
        !provider.isDependencyTreeStatic()
      ) {
        throw new Error(
          `MCP tool provider ${provider.name} must use singleton-compatible dependencies`,
        );
      }
      const instance: unknown = provider.instance;
      if (!isToolProvider(instance))
        throw new Error(
          `MCP tool provider ${provider.name} must implement getTools()`,
        );
      if (instance.instructions) instructions.push(instance.instructions);
      for (const tool of instance.getTools()) {
        if (!/^[\w.-]{1,128}$/.test(tool.name))
          throw new Error(`Invalid MCP tool name: ${tool.name}`);
        if (names.has(tool.name))
          throw new Error(`Duplicate MCP tool name: ${tool.name}`);
        tool.validateSchemas();
        names.add(tool.name);
        catalog.push(tool);
      }
    }
    this.tools = catalog.sort((left, right) =>
      left.name.localeCompare(right.name),
    );
    this.featureInstructions = instructions;
  }

  register(server: McpServer, invocation: McpInvocation): void {
    for (const tool of this.tools) tool.register(server, invocation);
  }
}
