import {
  Controller,
  Delete,
  Get,
  HttpCode,
  MethodNotAllowedException,
  Post,
  Req,
  Res,
  UseFilters,
  UseGuards,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';

import { McpExceptionFilter } from '@/app/mcp/mcp-exception.filter';
import { McpRateLimitGuard } from '@/app/mcp/mcp-rate-limit.guard';
import { McpRequestGuard } from '@/app/mcp/mcp-request.guard';
import { McpTransportService } from '@/app/mcp/mcp-transport.service';

import type { AuthenticatedRequest } from '@/app/auth';
import type { Response } from 'express';

@ApiExcludeController()
@SkipThrottle()
@UseFilters(McpExceptionFilter)
@UseGuards(McpRequestGuard, McpRateLimitGuard)
@Controller('mcp')
export class McpController {
  constructor(private readonly transport: McpTransportService) {}

  @Post()
  @HttpCode(200)
  async post(
    @Req() request: AuthenticatedRequest,
    @Res() response: Response,
  ): Promise<void> {
    await this.transport.handle(request, response);
  }

  @Get()
  get(@Res({ passthrough: true }) response: Response): never {
    response.setHeader('Allow', 'POST');
    throw new MethodNotAllowedException('Persistent MCP streams are disabled');
  }

  @Delete()
  delete(@Res({ passthrough: true }) response: Response): never {
    response.setHeader('Allow', 'POST');
    throw new MethodNotAllowedException('MCP sessions are disabled');
  }
}
