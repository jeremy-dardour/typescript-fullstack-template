import { NotFoundException } from '@nestjs/common';
import { vi } from 'vitest';

import { ProblemDetailsFilter } from '@/app/filters/problem-details.filter';
import { ProblemDetailsException } from '@/shared/exceptions/problem-details.exception';

import type { ArgumentsHost, HttpException } from '@nestjs/common';
import type { ClsService } from 'nestjs-cls';

function respond(exception: HttpException): Record<string, unknown> {
  const json = vi.fn();
  const response = {
    status: vi.fn().mockReturnThis(),
    setHeader: vi.fn(),
    json,
  };
  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ url: '/items', method: 'GET' }),
    }),
  } as unknown as ArgumentsHost;
  const cls = { getId: vi.fn(), get: vi.fn() } as unknown as ClsService;

  new ProblemDetailsFilter(cls).catch(exception, host);

  return json.mock.calls[0]![0] as Record<string, unknown>;
}

describe('problemDetailsFilter type URI', () => {
  it('derives the type from the status by default', () => {
    expect(respond(new NotFoundException()).type).toBe(
      'https://api.example.com/errors/not-found',
    );
  });

  it('uses the slug of a ProblemDetailsException', () => {
    const body = respond(
      new ProblemDetailsException(409, 'item-locked', 'The item is locked'),
    );

    expect(body).toMatchObject({
      type: 'https://api.example.com/errors/item-locked',
      status: 409,
      detail: 'The item is locked',
    });
  });

  it('uses the exception title for statuses without a standard one', () => {
    const body = respond(
      new ProblemDetailsException(410, 'item-archived', 'Archived', 'Gone'),
    );

    expect(body.title).toBe('Gone');
  });

  it('rejects a slug that would make an invalid type URI', () => {
    expect(
      () => new ProblemDetailsException(409, 'Item Locked', 'Locked'),
    ).toThrow(/kebab-case/);
  });
});
