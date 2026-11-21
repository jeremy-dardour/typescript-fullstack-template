import { z } from 'zod';

export const currentUserSchema = z
  .strictObject({
    sub: z
      .string()
      .describe('Stable subject identifier from the identity provider'),
    email: z.string().optional(),
    name: z.string().optional(),
  })
  .meta({ id: 'CurrentUserDto' });

export type CurrentUserDto = z.infer<typeof currentUserSchema>;
