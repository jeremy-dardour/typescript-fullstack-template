import { NotFoundError } from '@mikro-orm/core';
import {
  Catch,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  Optional,
  Inject,
} from '@nestjs/common';

import { ProblemDetailsFilter } from '@/app/filters/problem-details.filter';

import type { ExceptionFilter, ArgumentsHost } from '@nestjs/common';
import type { Response } from 'express';

/**
 * Global exception filter: maps every error to an HttpException and delegates
 * to ProblemDetailsFilter, so all responses are RFC 9457.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    @Optional()
    @Inject(ProblemDetailsFilter)
    private readonly problemDetailsFilter?: ProblemDetailsFilter,
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    const httpException = this.toHttpException(exception);

    if (this.problemDetailsFilter) {
      return this.problemDetailsFilter.catch(httpException, host);
    }

    const status = httpException.getStatus();
    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ status, title: httpException.message });
  }

  /**
   * Non-HTTP errors get a generic detail so internals (ORM filters, driver
   * messages) never reach the client; the original is kept as `cause` for logs.
   */
  private toHttpException(exception: unknown): HttpException {
    if (exception instanceof HttpException) {
      return exception;
    }
    if (exception instanceof NotFoundError) {
      return new NotFoundException('Resource not found', { cause: exception });
    }
    return new InternalServerErrorException('Internal server error', {
      cause: exception,
    });
  }
}
