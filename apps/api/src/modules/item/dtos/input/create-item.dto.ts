import { z } from 'zod';

export const itemNameSchema = z
  .string()
  .min(1)
  .max(255)
  .regex(/\S/, 'Name must contain a non-whitespace character');

export const createItemSchema = z
  .strictObject({
    name: itemNameSchema,
    description: z.string().nullable().optional(),
  })
  .meta({ id: 'CreateItemDto' });

export type CreateItemDto = z.infer<typeof createItemSchema>;
