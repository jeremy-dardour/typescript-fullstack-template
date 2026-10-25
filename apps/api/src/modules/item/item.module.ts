import { MikroOrmModule } from '@mikro-orm/nestjs';
import { Module } from '@nestjs/common';

import { Item } from '@/database/entities/item.entity';
import { ItemController } from '@/modules/item/item.controller';
import { ItemService } from '@/modules/item/item.service';
import { ItemRepository } from '@/modules/item/repositories/item.repository';

@Module({
  // Registers the entity for `autoLoadEntities`; persistence goes through ItemRepository.
  imports: [MikroOrmModule.forFeature([Item])],
  controllers: [ItemController],
  providers: [ItemService, ItemRepository],
})
export class ItemModule {}
