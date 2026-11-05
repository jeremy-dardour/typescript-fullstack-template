import { Module } from '@nestjs/common';

import { MeController } from '@/modules/auth/me.controller';

@Module({ controllers: [MeController] })
export class AuthFeatureModule {}
