import { z } from 'zod';

import type { SchemaObject } from '@nestjs/swagger';

export const fieldErrorSchema = z.strictObject({
  field: z.string().describe('Field name'),
  pointer: z.string().describe('RFC 6901 JSON Pointer to the invalid value'),
  code: z.string().describe('Stable machine-readable validation code'),
  message: z.string(),
  constraints: z.record(z.string(), z.unknown()).optional(),
  expected_format: z.string().optional(),
});

const problemDetailsStructure = z.strictObject({
  type: z.string().describe('Problem type URI'),
  title: z.string().describe('Short human-readable summary'),
  status: z.number().int().min(400).max(599),
  detail: z.string().optional(),
  instance: z.string().optional(),
  request_id: z.string().optional(),
  correlation_id: z.string().optional(),
  trace_id: z.string().optional(),
  timestamp: z.iso.datetime().optional(),
  errors: z.array(fieldErrorSchema).optional(),
});

export const problemDetailsSchema = problemDetailsStructure.meta({
  id: 'ProblemDetailsDto',
});

export type ProblemDetailsDto = z.infer<typeof problemDetailsSchema>;
export type FieldError = z.infer<typeof fieldErrorSchema>;

export const problemDetailsOpenApiSchema = z.toJSONSchema(
  problemDetailsStructure,
  {
    target: 'openapi-3.0',
  },
) as SchemaObject;
