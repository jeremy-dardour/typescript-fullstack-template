import { HttpException, HttpStatus } from '@nestjs/common';

export class McpRateLimitException extends HttpException {
  constructor(
    readonly limit: number,
    readonly resetAt: number,
  ) {
    super(
      `The MCP allowance is ${limit} requests per 60 seconds. Please retry later.`,
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
