import {
  offsetPaginationQuerySchema,
  offsetPaginationSchema,
} from '@/shared/dtos/offset-pagination.dto';

describe('offset pagination contracts', () => {
  it('uses the same defaults and limits for REST and JSON tool arguments', () => {
    expect(offsetPaginationSchema.parse({})).toEqual({
      page: 1,
      page_size: 20,
    });
    expect(offsetPaginationQuerySchema.parse({})).toEqual({
      page: 1,
      page_size: 20,
    });
    expect(
      offsetPaginationQuerySchema.parse({ page: '2', page_size: '100' }),
    ).toEqual({
      page: 2,
      page_size: 100,
    });
    expect(offsetPaginationSchema.parse({ page: 2, page_size: 100 })).toEqual({
      page: 2,
      page_size: 100,
    });
    expect(offsetPaginationSchema.safeParse({ page: '2' }).success).toBe(false);
  });

  it.each([
    { page: 0 },
    { page: -1 },
    { page: 1.5 },
    { page: null },
    { page_size: 0 },
    { page_size: 101 },
    { page_size: null },
    { unknown: true },
  ])('rejects invalid JSON pagination: %j', (input) => {
    expect(offsetPaginationSchema.safeParse(input).success).toBe(false);
  });
});
