import { z } from 'zod';

import { itemNameSchema } from '@/modules/item/dtos/input/create-item.dto';

export const updateItemSchema = z
  .strictObject({
    name: itemNameSchema.optional(),
    description: z.string().nullable().optional(),
  })
  .meta({ id: 'UpdateItemDto' });

export type UpdateItemDto = z.infer<typeof updateItemSchema>;
