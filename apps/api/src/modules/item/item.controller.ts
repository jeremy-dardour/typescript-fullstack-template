import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { createItemSchema } from '@/modules/item/dtos/input/create-item.dto';
import { updateItemSchema } from '@/modules/item/dtos/input/update-item.dto';
import {
  itemPageSchema,
  itemSchema,
  toItemDto,
} from '@/modules/item/dtos/output/item.dto';
import { ItemService } from '@/modules/item/item.service';
import { offsetPaginationQuerySchema } from '@/shared/dtos/offset-pagination.dto';
import { uuidSchema } from '@/shared/schemas/uuid.schema';

import type { CreateItemDto } from '@/modules/item/dtos/input/create-item.dto';
import type { UpdateItemDto } from '@/modules/item/dtos/input/update-item.dto';
import type { ItemDto, ItemPageDto } from '@/modules/item/dtos/output/item.dto';
import type { OffsetPaginationDto } from '@/shared/dtos/offset-pagination.dto';

@ApiTags('Items')
@Controller('items')
export class ItemController {
  constructor(private readonly itemService: ItemService) {}

  @Get()
  @ApiOperation({ summary: 'List a page of items, newest first' })
  @ApiResponse({ status: 200, standardSchema: itemPageSchema })
  async findAll(
    @Query({ schema: offsetPaginationQuerySchema })
    pagination: OffsetPaginationDto,
  ): Promise<ItemPageDto> {
    const page = await this.itemService.findAll(pagination);
    return { ...page, data: page.data.map((item) => toItemDto(item)) };
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get an item by ID' })
  @ApiResponse({ status: 200, standardSchema: itemSchema })
  async findOne(
    @Param('id', { schema: uuidSchema }) id: string,
  ): Promise<ItemDto> {
    return toItemDto(await this.itemService.findOne(id));
  }

  @Post()
  @ApiOperation({ summary: 'Create a new item' })
  @ApiResponse({ status: 201, standardSchema: itemSchema })
  async create(
    @Body({ schema: createItemSchema }) createItemDto: CreateItemDto,
  ): Promise<ItemDto> {
    return toItemDto(await this.itemService.create(createItemDto));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update an item' })
  @ApiResponse({ status: 200, standardSchema: itemSchema })
  async update(
    @Param('id', { schema: uuidSchema }) id: string,
    @Body({ schema: updateItemSchema }) updateItemDto: UpdateItemDto,
  ): Promise<ItemDto> {
    return toItemDto(await this.itemService.update(id, updateItemDto));
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an item' })
  @ApiResponse({ status: 204 })
  async remove(@Param('id', { schema: uuidSchema }) id: string): Promise<void> {
    return this.itemService.remove(id);
  }
}
