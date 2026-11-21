import { Injectable } from '@nestjs/common';

import { Item } from '@/database/entities/item.entity';
import { ItemRepository } from '@/modules/item/repositories/item.repository';

import type { CreateItemDto } from '@/modules/item/dtos/input/create-item.dto';
import type { UpdateItemDto } from '@/modules/item/dtos/input/update-item.dto';
import type { OffsetPaginationDto } from '@/shared/dtos/offset-pagination.dto';
import type { PaginatedListResponseDto } from '@/shared/dtos/output/paginated-list-response.dto';

@Injectable()
export class ItemService {
  constructor(private readonly itemRepository: ItemRepository) {}

  async findAll(
    pagination: OffsetPaginationDto,
  ): Promise<PaginatedListResponseDto<Item>> {
    const [data, total] = await this.itemRepository.findPageNewestFirst(
      pagination.page,
      pagination.page_size,
    );
    return {
      data,
      page: pagination.page,
      page_size: pagination.page_size,
      total,
      total_pages: Math.ceil(total / pagination.page_size),
    };
  }

  async findOne(id: string): Promise<Item> {
    return this.itemRepository.findOneOrFail({ id });
  }

  async create(createItemDto: CreateItemDto): Promise<Item> {
    const item = new Item();
    item.name = createItemDto.name;
    item.description = createItemDto.description;

    await this.itemRepository.save(item);
    return item;
  }

  async update(id: string, updateItemDto: UpdateItemDto): Promise<Item> {
    const item = await this.itemRepository.findOneOrFail({ id });

    if (updateItemDto.name !== undefined) {
      item.name = updateItemDto.name;
    }
    if (updateItemDto.description !== undefined) {
      item.description = updateItemDto.description;
    }

    await this.itemRepository.save(item);
    return item;
  }

  async remove(id: string): Promise<void> {
    const item = await this.itemRepository.findOneOrFail({ id });
    await this.itemRepository.delete(item);
  }
}
