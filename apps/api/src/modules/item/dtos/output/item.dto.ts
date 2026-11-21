import { z } from 'zod';

import { paginatedListSchema } from '@/shared/dtos/output/paginated-list-response.dto';
import { uuidSchema } from '@/shared/schemas/uuid.schema';

import type { Item } from '@/database/entities/item.entity';

export const itemSchema = z
  .strictObject({
    id: uuidSchema,
    name: z.string(),
    description: z.string().nullable(),
    createdAt: z.iso.datetime(),
    updatedAt: z.iso.datetime(),
  })
  .meta({ id: 'ItemDto' });

export type ItemDto = z.infer<typeof itemSchema>;

export const itemPageSchema = paginatedListSchema(itemSchema).meta({
  id: 'ItemPageDto',
});

export type ItemPageDto = z.infer<typeof itemPageSchema>;

export function toItemDto(item: Item): ItemDto {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}
