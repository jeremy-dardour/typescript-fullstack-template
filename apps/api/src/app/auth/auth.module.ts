import { Global, Module } from '@nestjs/common';

import { AuthInitializerService } from '@/app/auth/auth-initializer.service';
import { AuthGuard } from '@/app/auth/auth.guard';
import { JwtAuthService } from '@/app/auth/strategies/jwt/jwt-auth.service';
import { JwtVerificationService } from '@/app/auth/strategies/jwt/jwt-verification.service';
import { OidcDiscoveryService } from '@/app/auth/strategies/jwt/oidc-discovery.service';
import { MockAuthService } from '@/app/auth/strategies/mock-auth.service';

@Global()
@Module({
  providers: [
    OidcDiscoveryService,
    JwtVerificationService,
    JwtAuthService,
    MockAuthService,
    AuthInitializerService,
    AuthGuard,
  ],
  exports: [AuthInitializerService, AuthGuard],
})
export class AuthModule {}
