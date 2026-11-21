import { z } from 'zod';

import { offsetPaginationSchema } from '@/shared/dtos/offset-pagination.dto';
import { SortOptionValues } from '@/shared/types/sort-option.types';

export function createSearchPaginationSchema<Field extends z.ZodType>(
  fieldSchema: Field,
) {
  return offsetPaginationSchema.extend({
    search_fields: z.array(fieldSchema).optional(),
    query: z.string().optional(),
    sort_by: fieldSchema.optional(),
    sort_order: z.enum(SortOptionValues).default('ASC'),
  });
}

export type SearchPaginationRequestDto<Field extends z.ZodType> = z.infer<
  ReturnType<typeof createSearchPaginationSchema<Field>>
>;
