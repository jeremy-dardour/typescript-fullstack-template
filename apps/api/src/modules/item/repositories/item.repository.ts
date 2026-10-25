import { EntityRepository, SqlEntityManager } from '@mikro-orm/postgresql';
import { Injectable } from '@nestjs/common';

import { Item } from '@/database/entities/item.entity';

@Injectable()
export class ItemRepository extends EntityRepository<Item> {
  constructor(em: SqlEntityManager) {
    super(em, Item);
  }

  async findAllNewestFirst(): Promise<Item[]> {
    return this.findAll({ orderBy: { createdAt: 'DESC' } });
  }

  async save(item: Item): Promise<void> {
    this.em.persist(item);
    await this.em.flush();
  }

  async delete(item: Item): Promise<void> {
    this.em.remove(item);
    await this.em.flush();
  }
}
