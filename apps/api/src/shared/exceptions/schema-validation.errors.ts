import { HttpException } from '@nestjs/common';

import type { FieldError } from '@/shared/dtos/problem-details.dto';

export class SchemaValidationException extends HttpException {
  constructor(
    status: 400 | 422,
    readonly errors: FieldError[],
  ) {
    super({ message: 'Request validation failed', errors }, status);
  }
}
