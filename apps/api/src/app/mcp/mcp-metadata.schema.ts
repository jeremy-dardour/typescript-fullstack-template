import { z } from 'zod';

export const mcpMetadataSchema = z.strictObject({
  resource: z.url(),
  resource_name: z.string(),
  authorization_servers: z.array(z.url()).optional(),
  scopes_supported: z.array(z.string()),
  bearer_methods_supported: z.tuple([z.literal('header')]),
});

export type McpMetadata = z.infer<typeof mcpMetadataSchema>;
