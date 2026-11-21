import { z } from 'zod';

import {
  pageNumberSchema,
  pageSizeSchema,
} from '@/shared/dtos/offset-pagination.dto';

export function paginatedListSchema<T extends z.ZodType>(element: T) {
  return z.strictObject({
    data: z.array(element),
    page: pageNumberSchema,
    page_size: pageSizeSchema,
    total: z.int().min(0),
    total_pages: z.int().min(0),
  });
}

export type PaginatedListResponseDto<T> = z.infer<
  ReturnType<typeof paginatedListSchema<z.ZodType<T>>>
>;
