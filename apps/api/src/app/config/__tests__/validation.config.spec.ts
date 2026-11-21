import { z } from 'zod';

import { createValidationPipe } from '@/app/config/validation.config';
import { SchemaValidationException } from '@/shared/exceptions/schema-validation.errors';
import { uuidSchema } from '@/shared/schemas/uuid.schema';

import type { ArgumentMetadata } from '@nestjs/common';

async function validationError(
  value: unknown,
  metadata: ArgumentMetadata,
): Promise<SchemaValidationException> {
  try {
    await createValidationPipe().transform(value, metadata);
  } catch (error_) {
    if (error_ instanceof SchemaValidationException) return error_;
    throw error_;
  }
  throw new Error('Expected a schema validation error');
}

describe('schema validation HTTP contract', () => {
  const pipe = createValidationPipe();

  it('returns parsed values without coercing JSON strings implicitly', async () => {
    const schema = z.strictObject({ count: z.number().int() });

    await expect(
      pipe.transform({ count: 2 }, { type: 'body', schema }),
    ).resolves.toEqual({ count: 2 });
    await expect(
      pipe.transform({ count: '2' }, { type: 'body', schema }),
    ).rejects.toMatchObject({
      errors: [{ field: 'count', pointer: '/count', code: 'INVALID_TYPE' }],
    });
  });

  it('reports a body failure as 422 with escaped nested array pointers', async () => {
    const row = z.strictObject({ 'part~/name': z.number() });
    const schema = z.strictObject({ rows: z.array(row) });
    const error = await validationError(
      { rows: [{ 'part~/name': 'invalid' }] },
      { type: 'body', schema },
    );

    expect(error).toBeInstanceOf(SchemaValidationException);
    expect(error).toMatchObject({
      errors: [
        {
          field: 'rows.0.part~/name',
          pointer: '/rows/0/part~0~1name',
          code: 'INVALID_TYPE',
        },
      ],
    });
    expect(error.getStatus()).toBe(422);
  });

  it('identifies each unknown field without stripping it silently', async () => {
    const schema = z.strictObject({ name: z.string() });

    await expect(
      pipe.transform(
        { name: 'Item', 'extra/one': true, 'extra~two': true },
        { type: 'body', schema },
      ),
    ).rejects.toMatchObject({
      errors: [
        {
          field: 'extra/one',
          pointer: '/extra~1one',
          code: 'UNKNOWN_FIELD',
        },
        {
          field: 'extra~two',
          pointer: '/extra~0two',
          code: 'UNKNOWN_FIELD',
        },
      ],
    });
  });

  it('reports UUID path failures as 400 with the named parameter', async () => {
    const error = await validationError('invalid', {
      type: 'param',
      data: 'id',
      schema: uuidSchema,
    });

    expect(error).toBeInstanceOf(SchemaValidationException);
    expect(error).toMatchObject({
      errors: [{ field: 'id', pointer: '/id', code: 'INVALID_UUID' }],
    });
    expect(error.getStatus()).toBe(400);
  });
});
