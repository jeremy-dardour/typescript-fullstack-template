import { toNodeHandler, toWebRequest } from '@modelcontextprotocol/node';
import { createMcpHandler, McpServer } from '@modelcontextprotocol/server';
import {
  Injectable,
  Logger,
  RequestTimeoutException,
  UnauthorizedException,
} from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { z } from 'zod';

import {
  MCP_PROTOCOL_VERSIONS,
  MCP_REQUEST_TIMEOUT_MS,
} from '@/app/mcp/mcp.config';

import apiPackage from '@/../package.json';

import type { AuthenticatedRequest, AuthenticatedUser } from '@/app/auth';
import type { McpHttpHandler } from '@modelcontextprotocol/server';
import type { OnModuleDestroy } from '@nestjs/common';
import type { Response } from 'express';

const errorDataSchema = z.record(z.string(), z.unknown());
const unsupportedVersionResponseSchema = z.looseObject({
  error: z.looseObject({
    code: z.literal(-32_022),
    data: errorDataSchema.optional(),
  }),
});

async function normalizeSupportedVersions(response: globalThis.Response) {
  if (
    response.status !== 400 ||
    !response.headers.get('content-type')?.includes('application/json')
  ) {
    return response;
  }
  const parsed = unsupportedVersionResponseSchema.safeParse(
    await response.clone().json(),
  );
  if (!parsed.success) return response;
  parsed.data.error.data = {
    ...parsed.data.error.data,
    supported: [...MCP_PROTOCOL_VERSIONS],
  };
  const headers = new Headers(response.headers);
  headers.delete('content-length');
  return new globalThis.Response(JSON.stringify(parsed.data), {
    status: response.status,
    headers,
  });
}

@Injectable()
export class McpTransportService implements OnModuleDestroy {
  private readonly logger = new Logger(McpTransportService.name);
  private readonly active = new Map<McpHttpHandler, AbortController>();

  constructor(private readonly cls: ClsService) {}

  protected createServer(
    _caller: AuthenticatedUser,
    _requestId: string,
  ): McpServer {
    return new McpServer(
      {
        name: 'template-api',
        title: 'Template API',
        version: apiPackage.version,
      },
      {
        supportedProtocolVersions: [...MCP_PROTOCOL_VERSIONS],
        instructions:
          'Items are application records identified by UUID. List Items to find an unknown identifier.',
        cacheHints: {
          'server/discover': { ttlMs: 0, cacheScope: 'private' },
          'tools/list': { ttlMs: 0, cacheScope: 'private' },
        },
      },
    );
  }

  async handle(
    request: AuthenticatedRequest,
    response: Response,
  ): Promise<void> {
    const caller = request.user;
    if (!caller) throw new UnauthorizedException();
    const requestId = this.cls.getId();
    const abort = new AbortController();
    const servers = new Set<McpServer>();
    const handler = createMcpHandler(
      () => {
        const server = this.createServer(caller, requestId);
        servers.add(server);
        return server;
      },
      {
        legacy: 'stateless',
        onerror: (error) => {
          this.logger.warn({ requestId, message: error.message });
        },
      },
    );
    this.active.set(handler, abort);
    const disconnect = () => {
      if (!response.writableEnded) abort.abort();
    };
    request.once('aborted', disconnect);
    response.once('close', disconnect);

    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<never>((_resolve, reject) => {
      timer = setTimeout(() => {
        reject(new RequestTimeoutException('MCP request exceeded 15000ms'));
        abort.abort();
      }, MCP_REQUEST_TIMEOUT_MS).unref();
    });
    const exchange = async () => {
      const webRequest = await toWebRequest(request, request.body, {
        signal: abort.signal,
      });
      const result = await handler.fetch(webRequest, {
        parsedBody: request.body,
      });
      if (abort.signal.aborted || response.headersSent || response.destroyed) {
        await result.body?.cancel();
        return;
      }
      const normalized = await normalizeSupportedVersions(result);
      if (abort.signal.aborted || response.headersSent || response.destroyed) {
        await normalized.body?.cancel();
        return;
      }
      // Let the SDK own response serialization/backpressure after our deadline gate.
      await toNodeHandler({ fetch: () => Promise.resolve(normalized) })(
        request,
        response,
        request.body,
      );
    };
    try {
      await Promise.race([exchange(), deadline]);
    } finally {
      clearTimeout(timer);
      request.off('aborted', disconnect);
      response.off('close', disconnect);
      abort.abort();
      this.active.delete(handler);
      await handler.close();
      await Promise.allSettled([...servers].map((server) => server.close()));
    }
  }

  async onModuleDestroy(): Promise<void> {
    await Promise.allSettled(
      [...this.active].map(([handler, abort]) => {
        abort.abort();
        return handler.close();
      }),
    );
  }
}
