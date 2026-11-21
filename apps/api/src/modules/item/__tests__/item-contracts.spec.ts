import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Test } from '@nestjs/testing';

import { Item } from '@/database/entities/item.entity';
import { createItemSchema } from '@/modules/item/dtos/input/create-item.dto';
import { updateItemSchema } from '@/modules/item/dtos/input/update-item.dto';
import { itemSchema, toItemDto } from '@/modules/item/dtos/output/item.dto';
import { ItemController } from '@/modules/item/item.controller';
import { ItemService } from '@/modules/item/item.service';

describe('item contracts', () => {
  it.each(['', ' '.repeat(3), '\t\n', 'a'.repeat(256), null, 12])(
    'rejects an invalid name on create and update: %j',
    (name) => {
      expect(createItemSchema.safeParse({ name }).success).toBe(false);
      expect(updateItemSchema.safeParse({ name }).success).toBe(false);
    },
  );

  it('preserves meaningful name spacing and accepts the maximum name length', () => {
    expect(createItemSchema.parse({ name: '  Item  ' }).name).toBe('  Item  ');
    expect(createItemSchema.parse({ name: 'a'.repeat(255) }).name).toHaveLength(
      255,
    );
  });

  it('preserves omitted and explicit null description semantics', () => {
    expect(createItemSchema.parse({ name: 'Item' })).not.toHaveProperty(
      'description',
    );
    expect(createItemSchema.parse({ name: 'Item', description: null })).toEqual(
      {
        name: 'Item',
        description: null,
      },
    );
    expect(updateItemSchema.parse({})).toEqual({});
    expect(updateItemSchema.parse({ description: null })).toEqual({
      description: null,
    });
  });

  it('rejects unknown input fields in both contracts', () => {
    expect(
      createItemSchema.safeParse({ name: 'Item', actor: 'client' }).success,
    ).toBe(false);
    expect(updateItemSchema.safeParse({ actor: 'client' }).success).toBe(false);
  });

  it('maps entity timestamps and absent descriptions to the advertised JSON shape', () => {
    const item = new Item();
    item.id = '9eae778d-5ef5-414c-9e59-3eed8ce65de3';
    item.name = 'Item';
    item.createdAt = new Date('2026-01-01T00:00:00.000Z');
    item.updatedAt = new Date('2026-01-02T00:00:00.000Z');

    expect(itemSchema.parse(toItemDto(item))).toEqual({
      id: item.id,
      name: 'Item',
      description: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-02T00:00:00.000Z',
    });
  });

  it('keeps named OpenAPI components with required nullable descriptions', async () => {
    const module = await Test.createTestingModule({
      controllers: [ItemController],
      providers: [{ provide: ItemService, useValue: {} }],
    }).compile();
    const app = module.createNestApplication();

    try {
      await app.init();
      const document = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().build(),
      );
      const schemas = document.components?.schemas;

      expect(schemas).toHaveProperty('CreateItemDto');
      expect(schemas).toHaveProperty('UpdateItemDto');
      expect(schemas?.ItemDto).toMatchObject({
        required: ['id', 'name', 'description', 'createdAt', 'updatedAt'],
        properties: {
          description: { type: 'string', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          updatedAt: { type: 'string', format: 'date-time' },
        },
      });
    } finally {
      await app.close();
    }
  });
});
