import { z } from 'zod';

function paginationFields(number: z.ZodNumber | z.ZodCoercedNumber) {
  return {
    page: number.int().min(1).default(1),
    page_size: number.int().min(1).max(100).default(20),
  };
}

const fields = paginationFields(z.number());

export const pageNumberSchema = fields.page.unwrap();
export const pageSizeSchema = fields.page_size.unwrap();
export const offsetPaginationSchema = z.strictObject(fields);
export const offsetPaginationQuerySchema = z.strictObject(
  paginationFields(z.coerce.number()),
);

export type OffsetPaginationDto = z.infer<typeof offsetPaginationSchema>;
