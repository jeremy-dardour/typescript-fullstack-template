import { ApiProperty } from '@nestjs/swagger';

import type { Item } from '@/database/entities/item.entity';

export class ItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ nullable: true })
  description?: string | null;

  @ApiProperty()
  createdAt!: Date;

  @ApiProperty()
  updatedAt!: Date;
}

export function toItemDto(item: Item): ItemDto {
  return {
    id: item.id,
    name: item.name,
    description: item.description ?? null,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  };
}
