import { z } from 'zod';

export const healthIndicatorSchema = z.looseObject({
  status: z.enum(['up', 'down']),
  message: z.string().optional(),
});

export const healthResponseSchema = z
  .record(z.string(), healthIndicatorSchema)
  .meta({ id: 'HealthResponse' });

export type HealthIndicatorResult = z.infer<typeof healthIndicatorSchema>;
export type HealthResponse = z.infer<typeof healthResponseSchema>;
