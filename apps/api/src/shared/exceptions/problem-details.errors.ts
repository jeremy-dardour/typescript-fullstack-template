import { HttpException } from '@nestjs/common';

const TYPE_SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/**
 * An HTTP exception with a stable RFC 9457 problem type. The global filter
 * turns `typeSlug` into the absolute type URI.
 */
export class ProblemDetailsException extends HttpException {
  constructor(
    status: number,
    readonly typeSlug: string,
    detail: string,
    readonly title?: string,
  ) {
    if (!TYPE_SLUG.test(typeSlug)) {
      throw new Error(`Problem type slug must be kebab-case: "${typeSlug}"`);
    }
    super(detail, status);
  }
}
