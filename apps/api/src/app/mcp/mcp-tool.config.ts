import { NotFoundError } from '@mikro-orm/core';
import { HttpException, Logger } from '@nestjs/common';
import { z } from 'zod';

import type {
  McpInvocation,
  McpToolDefinition,
} from '@/app/mcp/mcp-tool.types';
import type {
  StandardSchemaWithJSON,
  ToolAnnotations,
} from '@modelcontextprotocol/server';

const logger = new Logger('McpTools');
const jsonValueSchema = z.json();

function validateReferences(schema: unknown): void {
  function visit(value: unknown): void {
    if (!value || typeof value !== 'object') return;
    if ('$ref' in value && typeof value.$ref === 'string') {
      const ref = value.$ref;
      if (ref !== '#' && !ref.startsWith('#/')) {
        throw new Error(`MCP schemas require local references: ${ref}`);
      }
      if (ref !== '#') {
        let target: unknown = schema;
        const pointer = decodeURIComponent(ref.slice(2));
        for (const token of pointer.split('/')) {
          if (/~(?![01])/.test(token)) {
            throw new Error(`Invalid MCP schema reference: ${ref}`);
          }
          const key = token.replaceAll('~1', '/').replaceAll('~0', '~');
          if (
            !target ||
            typeof target !== 'object' ||
            !Object.hasOwn(target, key)
          ) {
            throw new Error(`Unresolved MCP schema reference: ${ref}`);
          }
          target = Reflect.get(target, key);
        }
      }
    }
    for (const child of Object.values(value)) visit(child);
  }
  visit(schema);
}

/** Binds concrete schemas and handler types before a heterogeneous catalog erases them. */
export function defineTool<
  Input extends z.ZodObject,
  Output extends z.ZodObject,
>(definition: {
  name: string;
  title: string;
  description: string;
  input: Input;
  output: Output;
  annotations: ToolAnnotations;
  handler: (
    input: NoInfer<StandardSchemaWithJSON.InferOutput<Input>>,
    invocation: McpInvocation,
  ) => NoInfer<z.output<Output>> | Promise<NoInfer<z.output<Output>>>;
}): McpToolDefinition {
  return {
    name: definition.name,
    validateSchemas() {
      const inputJson = definition.input['~standard'].jsonSchema.input({
        target: 'draft-2020-12',
      });
      const outputJson = definition.output['~standard'].jsonSchema.output({
        target: 'draft-2020-12',
      });
      validateReferences(inputJson);
      validateReferences(outputJson);
      JSON.stringify(inputJson);
      JSON.stringify(outputJson);
    },
    register(server, invocation) {
      const nativeSchema: StandardSchemaWithJSON<
        unknown,
        StandardSchemaWithJSON.InferOutput<Input>
      > = definition.input;
      const standard = nativeSchema['~standard'];
      const inputSchema: typeof nativeSchema = {
        '~standard': {
          ...standard,
          async validate(value, options) {
            const startedAt = performance.now();
            const result = await standard.validate(value, options);
            if (result.issues) {
              logger.log({
                tool: definition.name,
                requestId: invocation.requestId,
                outcome: 'invalid_input',
                elapsedMs: performance.now() - startedAt,
              });
            }
            return result;
          },
        },
      };
      server.registerTool<Output, typeof inputSchema>(
        definition.name,
        {
          title: definition.title,
          description: definition.description,
          inputSchema,
          outputSchema: definition.output,
          annotations: definition.annotations,
        },
        async (input) => {
          const startedAt = performance.now();
          let outcome = 'success';
          try {
            invocation.signal.throwIfAborted();
            const result = await definition.handler(input, invocation);
            const output = definition.output.parse(result);
            jsonValueSchema.parse(output);
            const text = JSON.stringify(output);
            if (invocation.signal.aborted) outcome = 'completed_after_abort';
            return {
              structuredContent: output,
              content: [{ type: 'text', text }],
            };
          } catch (error) {
            outcome = 'error';
            let message: string;
            if (error instanceof NotFoundError) {
              message = 'Resource not found';
            } else if (
              error instanceof HttpException &&
              error.getStatus() < 500
            ) {
              message = error.message;
            } else {
              message = `The tool could not be completed. Request ID: ${invocation.requestId}`;
              logger.error(
                { tool: definition.name, requestId: invocation.requestId },
                error instanceof Error
                  ? error.stack
                  : 'Unexpected tool failure',
              );
            }
            return {
              isError: true,
              content: [{ type: 'text', text: message }],
            };
          } finally {
            logger.log({
              tool: definition.name,
              requestId: invocation.requestId,
              outcome,
              elapsedMs: performance.now() - startedAt,
            });
          }
        },
      );
    },
  };
}
