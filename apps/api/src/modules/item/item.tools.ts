import { z } from 'zod';

import { defineTool, McpToolProvider } from '@/app/mcp';
import { createItemSchema } from '@/modules/item/dtos/input/create-item.dto';
import { updateItemSchema } from '@/modules/item/dtos/input/update-item.dto';
import {
  itemPageSchema,
  itemSchema,
  toItemDto,
} from '@/modules/item/dtos/output/item.dto';
import { ItemService } from '@/modules/item/item.service';
import { offsetPaginationSchema } from '@/shared/dtos/offset-pagination.dto';
import { uuidSchema } from '@/shared/schemas/uuid.schema';

import type { McpToolProviderContract } from '@/app/mcp';

@McpToolProvider()
export class ItemTools implements McpToolProviderContract {
  readonly instructions =
    'Items are application records identified by UUID. Use list_items with page and page_size to find an unknown identifier.';

  constructor(private readonly items: ItemService) {}

  getTools() {
    return [
      defineTool({
        name: 'update_item',
        title: 'Update Item',
        description:
          'Update an Item by UUID; omit description to preserve it or use null to clear it.',
        input: updateItemSchema.extend({ id: uuidSchema }),
        output: itemSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: true,
          idempotentHint: true,
          openWorldHint: false,
        },
        handler: async ({ id, ...changes }) =>
          toItemDto(await this.items.update(id, changes)),
      }),
      defineTool({
        name: 'create_item',
        title: 'Create Item',
        description:
          'Create an Item with a name and optional description; return its UUID and timestamps.',
        input: createItemSchema,
        output: itemSchema,
        annotations: {
          readOnlyHint: false,
          destructiveHint: false,
          idempotentHint: false,
          openWorldHint: false,
        },
        handler: async (input) => toItemDto(await this.items.create(input)),
      }),
      defineTool({
        name: 'list_items',
        title: 'List Items',
        description:
          'List a page of Items, newest first, with page and total counts.',
        input: offsetPaginationSchema,
        output: itemPageSchema,
        annotations: { readOnlyHint: true, openWorldHint: false },
        handler: async (input) => {
          const page = await this.items.findAll(input);
          return { ...page, data: page.data.map((item) => toItemDto(item)) };
        },
      }),
      defineTool({
        name: 'get_item',
        title: 'Get Item',
        description:
          'Get one Item by its UUID, including its name, description and timestamps.',
        input: z.strictObject({ id: uuidSchema }),
        output: itemSchema,
        annotations: { readOnlyHint: true, openWorldHint: false },
        handler: async ({ id }) => toItemDto(await this.items.findOne(id)),
      }),
    ];
  }
}
