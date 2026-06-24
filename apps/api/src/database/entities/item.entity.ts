import { Entity, OptionalProps, PrimaryKey, Property } from '@mikro-orm/core';

@Entity()
export class Item {
  [OptionalProps]?: 'id' | 'description' | 'createdAt' | 'updatedAt';

  @PrimaryKey({ type: 'uuid', defaultRaw: 'gen_random_uuid()' })
  id!: string;

  @Property({ length: 255 })
  name!: string;

  @Property({ type: 'text', nullable: true })
  description?: string | null;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  createdAt!: Date;

  @Property({ type: 'timestamptz', defaultRaw: 'now()' })
  updatedAt!: Date;
}
