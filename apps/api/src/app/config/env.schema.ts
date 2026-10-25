import path from 'node:path';

import { z } from 'zod';

import { baseEnvSchema } from '@/shared/types/env.base.schema';
import { validateEnvSchema } from '@/shared/utils/env.validator';

const REAL_AUTH_VARIABLES = [
  'AUTH_CLIENT_ID',
  'AUTH_OIDC_DISCOVERY_URL',
  'AUTH_ACCEPTED_SCOPES',
] as const;

export const envSchema = baseEnvSchema
  .extend({
    PORT: z
      .string()
      .default('3000')
      .transform(Number)
      .refine((value) => value > 0 && value < 65_536, {
        message: 'PORT must be between 1-65535',
      }),

    // Absolute path to a built SPA to serve; unset keeps the API JSON-only.
    SERVE_STATIC_DIR: z
      .string()
      .refine((value) => path.isAbsolute(value), {
        message: 'SERVE_STATIC_DIR must be an absolute path',
      })
      .optional(),

    // Memory ceilings for the health checks. Size them to the container limit:
    // the TsMorph metadata provider alone keeps the TypeScript compiler loaded.
    HEALTH_MAX_HEAP_MB: z.coerce.number().int().positive().default(512),
    HEALTH_MAX_RSS_MB: z.coerce.number().int().positive().default(1024),

    AUTH_CLIENT_ID: z.string().min(1).optional(),
    // Expected `aud` claim; defaults to AUTH_CLIENT_ID. Entra ID access tokens
    // use `api://<client-id>`.
    AUTH_AUDIENCE: z.string().min(1).optional(),
    AUTH_OIDC_DISCOVERY_URL: z.url().optional(),
    AUTH_ACCEPTED_SCOPES: z
      .string()
      .transform((value) => value.split(',').map((scope) => scope.trim()))
      .refine((value) => value.every((s) => s.length > 0), {
        message:
          'AUTH_ACCEPTED_SCOPES must be a comma-separated list of non-empty scopes',
      })
      .optional(),
    FAKE_AUTH: z
      .string()
      .default('false')
      .transform((value) => value.toLowerCase() === 'true'),
  })
  .superRefine((env, context) => {
    if (env.FAKE_AUTH) {
      return;
    }
    for (const variable of REAL_AUTH_VARIABLES) {
      if (env[variable] === undefined) {
        context.addIssue({
          code: 'custom',
          path: [variable],
          message: `${variable} is required when FAKE_AUTH is not true`,
        });
      }
    }
  });

export type Env = z.infer<typeof envSchema>;

export function validateEnv(config: Record<string, unknown>): Env {
  const env = validateEnvSchema(envSchema, config, 'App');

  // Checked against the raw config: NODE_ENV defaults to 'development', and
  // mock auth must never switch on because a missing NODE_ENV defaulted.
  if (
    env.FAKE_AUTH &&
    config.NODE_ENV !== 'development' &&
    config.NODE_ENV !== 'test'
  ) {
    throw new Error(
      'App environment validation failed:\nFAKE_AUTH: FAKE_AUTH=true requires NODE_ENV to be explicitly set to development or test\n\nCheck .env file or environment variables',
    );
  }

  return env;
}
