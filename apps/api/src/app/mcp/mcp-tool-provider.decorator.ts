import { applyDecorators, Injectable, SetMetadata } from '@nestjs/common';

export const MCP_TOOL_PROVIDER = Symbol('MCP_TOOL_PROVIDER');

export function McpToolProvider(): ClassDecorator {
  return applyDecorators(Injectable(), SetMetadata(MCP_TOOL_PROVIDER, true));
}
