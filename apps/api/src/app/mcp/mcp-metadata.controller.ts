import { Controller, Get, Header, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiExcludeController } from '@nestjs/swagger';

import { OidcDiscoveryService, Public } from '@/app/auth';
import { mcpMetadataSchema } from '@/app/mcp/mcp-metadata.schema';
import { McpRequestGuard } from '@/app/mcp/mcp-request.guard';

import type { Env } from '@/app/config';
import type { McpMetadata } from '@/app/mcp/mcp-metadata.schema';

@ApiExcludeController()
@UseGuards(McpRequestGuard)
@Controller('.well-known/oauth-protected-resource')
export class McpMetadataController {
  constructor(
    private readonly config: ConfigService<Env, true>,
    private readonly oidc: OidcDiscoveryService,
  ) {}

  @Public()
  @Get('mcp')
  @Header('Cache-Control', 'private, no-store')
  get(): McpMetadata {
    return mcpMetadataSchema.parse({
      resource: this.config.getOrThrow('MCP_PUBLIC_URL', { infer: true }),
      resource_name: 'Template API',
      ...(!this.config.get('FAKE_AUTH', { infer: true }) && {
        authorization_servers: [this.oidc.getIssuer()],
      }),
      scopes_supported:
        this.config.get('AUTH_ACCEPTED_SCOPES', { infer: true }) ?? [],
      bearer_methods_supported: ['header'],
    });
  }
}
