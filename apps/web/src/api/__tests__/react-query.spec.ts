import { describe, expect, it } from 'vitest';

import { ApiError } from '@/api/errors';
import { isLocallyHandledError } from '@/api/react-query';

describe('isLocallyHandledError', () => {
  const notFound = new ApiError('Not Found', 404, 'Not Found');

  it('is true for a status the query declares it handles', () => {
    expect(isLocallyHandledError(notFound, { localErrorStatuses: [404] })).toBe(
      true,
    );
  });

  it('is false for other statuses or queries without the meta', () => {
    expect(isLocallyHandledError(notFound, { localErrorStatuses: [409] })).toBe(
      false,
    );
    expect(isLocallyHandledError(notFound, undefined)).toBe(false);
  });
});
