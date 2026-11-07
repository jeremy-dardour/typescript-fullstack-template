import { Global, Module } from '@nestjs/common';

import { AuthInitializerService } from '@/app/auth/auth-initializer.service';
import { AuthGuard } from '@/app/auth/auth.guard';
import { JwtAuthStrategyService } from '@/app/auth/strategies/jwt/jwt-auth-strategy.service';
import { JwtVerificationService } from '@/app/auth/strategies/jwt/jwt-verification.service';
import { OidcDiscoveryService } from '@/app/auth/strategies/jwt/oidc-discovery.service';
import { MockAuthStrategyService } from '@/app/auth/strategies/mock-auth-strategy.service';

@Global()
@Module({
  providers: [
    OidcDiscoveryService,
    JwtVerificationService,
    JwtAuthStrategyService,
    MockAuthStrategyService,
    AuthInitializerService,
    AuthGuard,
  ],
  exports: [AuthInitializerService, AuthGuard],
})
export class AuthInfrastructureModule {}
