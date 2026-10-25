import { Global, Module } from '@nestjs/common';

import { AuthInitializerService } from '@/app/auth/auth-initializer.service';
import { AuthGuard } from '@/app/auth/auth.guard';
import { MeController } from '@/app/auth/me/me.controller';
import { JwtAuthStrategy } from '@/app/auth/strategies/jwt/jwt-auth.strategy';
import { JwtVerificationService } from '@/app/auth/strategies/jwt/jwt-verification.service';
import { OidcDiscoveryService } from '@/app/auth/strategies/jwt/oidc-discovery.service';
import { MockAuthStrategy } from '@/app/auth/strategies/mock-auth.strategy';

@Global()
@Module({
  controllers: [MeController],
  providers: [
    OidcDiscoveryService,
    JwtVerificationService,
    JwtAuthStrategy,
    MockAuthStrategy,
    AuthInitializerService,
    AuthGuard,
  ],
  exports: [AuthInitializerService, AuthGuard],
})
export class AuthModule {}
