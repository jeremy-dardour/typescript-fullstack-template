import { Module } from '@nestjs/common';
import { DiscoveryModule } from '@nestjs/core';

import { AuthInfrastructureModule } from '@/app/auth';
import { ProblemDetailsFilter } from '@/app/filters';
import { McpCatalogService } from '@/app/mcp/mcp-catalog.service';
import { McpExceptionFilter } from '@/app/mcp/mcp-exception.filter';
import { McpMetadataController } from '@/app/mcp/mcp-metadata.controller';
import { McpRateLimitGuard } from '@/app/mcp/mcp-rate-limit.guard';
import { McpRequestGuard } from '@/app/mcp/mcp-request.guard';
import { McpTransportService } from '@/app/mcp/mcp-transport.service';
import { McpController } from '@/app/mcp/mcp.controller';

import type { DynamicModule } from '@nestjs/common';

@Module({})
export class McpModule {
  static register(isEnabled: boolean): DynamicModule {
    return isEnabled
      ? {
          module: this,
          imports: [AuthInfrastructureModule, DiscoveryModule],
          controllers: [McpController, McpMetadataController],
          providers: [
            McpTransportService,
            McpRequestGuard,
            McpRateLimitGuard,
            McpExceptionFilter,
            ProblemDetailsFilter,
            McpCatalogService,
          ],
          exports: [McpTransportService],
        }
      : { module: this };
  }
}
