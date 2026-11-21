import { z } from 'zod';

import { createSearchPaginationSchema } from '@/shared/dtos/input/search-pagination-request.dto';

describe('search pagination contracts', () => {
  const schema = createSearchPaginationSchema(z.enum(['name', 'description']));

  it('applies the common page defaults and ascending sort', () => {
    expect(schema.parse({ query: 'example' })).toEqual({
      page: 1,
      page_size: 20,
      query: 'example',
      sort_order: 'ASC',
    });
  });

  it('uses the supplied field schema for search and sort fields', () => {
    expect(
      schema.parse({ search_fields: ['name'], sort_by: 'description' }),
    ).toMatchObject({ search_fields: ['name'], sort_by: 'description' });
    expect(schema.safeParse({ search_fields: ['unrecognized'] }).success).toBe(
      false,
    );
    expect(schema.safeParse({ sort_by: 'unrecognized' }).success).toBe(false);
  });

  it.each([
    { query: null },
    { search_fields: null },
    { page_size: 101 },
    { page: 1.5 },
    { unknown: true },
  ])('rejects invalid search arguments %j', (input) => {
    expect(schema.safeParse(input).success).toBe(false);
  });
});
