import {
  StandardSchemaValidationPipe,
  ValidationPipe,
  UnprocessableEntityException,
  HttpStatus,
} from '@nestjs/common';

import { SchemaValidationException } from '@/shared/exceptions/schema-validation.errors';

import type { FieldError } from '@/shared/dtos/problem-details.dto';
import type {
  ArgumentMetadata,
  PipeTransform,
  StandardSchemaValidationPipeOptions,
} from '@nestjs/common';

type SchemaIssues = Parameters<
  NonNullable<StandardSchemaValidationPipeOptions['exceptionFactory']>
>[0];

export function createValidationPipe(): PipeTransform<
  unknown,
  Promise<unknown>
> {
  const legacyPipe = new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    stopAtFirstError: false,
    errorHttpStatusCode: HttpStatus.UNPROCESSABLE_ENTITY,
    exceptionFactory: (errors) => new UnprocessableEntityException(errors),
  });

  return {
    async transform(
      value: unknown,
      metadata: ArgumentMetadata,
    ): Promise<unknown> {
      if (!metadata.schema) {
        const transformed: unknown = await legacyPipe.transform(
          value,
          metadata,
        );
        return transformed;
      }

      const status = metadata.type === 'body' ? 422 : 400;
      const schemaPipe = new StandardSchemaValidationPipe({
        exceptionFactory: (issues) =>
          new SchemaValidationException(
            status,
            toFieldErrors(issues, metadata.data),
          ),
      });
      const transformed: unknown = await schemaPipe.transform(value, metadata);
      return transformed;
    },
  };
}

function toFieldErrors(issues: SchemaIssues, parameter?: string): FieldError[] {
  return issues.flatMap((issue) => {
    const path = [
      ...(parameter ? [parameter] : []),
      ...(issue.path ?? []).map((segment) =>
        String(typeof segment === 'object' ? segment.key : segment),
      ),
    ];
    const unknownKeys =
      'code' in issue &&
      issue.code === 'unrecognized_keys' &&
      'keys' in issue &&
      Array.isArray(issue.keys)
        ? issue.keys.filter((key): key is string => typeof key === 'string')
        : undefined;

    return (unknownKeys?.map((key) => [...path, key]) ?? [path]).map(
      (fieldPath) => ({
        field: fieldPath.join('.') || '$',
        pointer:
          fieldPath.length > 0
            ? `/${fieldPath.map((segment) => escapePointerSegment(segment)).join('/')}`
            : '',
        code: issueCode(issue),
        message: issue.message,
      }),
    );
  });
}

function escapePointerSegment(segment: string): string {
  return segment.replaceAll('~', '~0').replaceAll('/', '~1');
}

function issueCode(issue: SchemaIssues[number]): string {
  if (!('code' in issue)) return 'VALIDATION_ERROR';

  switch (issue.code) {
    case 'unrecognized_keys': {
      return 'UNKNOWN_FIELD';
    }
    case 'invalid_type': {
      return 'INVALID_TYPE';
    }
    case 'too_small':
    case 'too_big': {
      return 'origin' in issue && issue.origin === 'string'
        ? 'INVALID_LENGTH'
        : 'INVALID_RANGE';
    }
    case 'invalid_format': {
      return 'format' in issue && issue.format === 'uuid'
        ? 'INVALID_UUID'
        : 'INVALID_FORMAT';
    }
    case 'invalid_value': {
      return 'INVALID_VALUE';
    }
    default: {
      return 'VALIDATION_ERROR';
    }
  }
}
