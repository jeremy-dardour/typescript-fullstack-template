import type { AuthenticatedUser } from '@/app/auth';
import type { McpServer } from '@modelcontextprotocol/server';

export interface McpInvocation {
  readonly caller: AuthenticatedUser;
  readonly requestId: string;
  readonly signal: AbortSignal;
}

export interface McpToolDefinition {
  readonly name: string;
  validateSchemas(): void;
  register(server: McpServer, invocation: McpInvocation): void;
}

export interface McpToolProviderContract {
  readonly instructions?: string;
  getTools(): readonly McpToolDefinition[];
}
