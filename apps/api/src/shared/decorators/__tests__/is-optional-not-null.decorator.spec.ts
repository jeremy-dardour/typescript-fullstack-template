import { IsOptional, IsString, validate } from 'class-validator';

import { IsOptionalNotNull } from '@/shared/decorators/is-optional-not-null.decorator';

class Patch {
  @IsString()
  @IsOptionalNotNull()
  name?: string | null;

  @IsString()
  @IsOptional()
  description?: string | null;
}

function patch(values: Partial<Patch>): Patch {
  return Object.assign(new Patch(), values);
}

describe('isOptionalNotNull', () => {
  it('accepts an omitted field', async () => {
    expect(await validate(patch({}))).toHaveLength(0);
  });

  it('rejects an explicit null that @IsOptional() would let through', async () => {
    const errors = await validate(patch({ name: null, description: null }));

    expect(errors.map((error) => error.property)).toEqual(['name']);
  });
});
