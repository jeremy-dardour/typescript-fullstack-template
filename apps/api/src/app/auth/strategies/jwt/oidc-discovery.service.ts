import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet } from 'jose';
import * as oidc from 'openid-client';

import { OidcServiceUnavailableException } from '@/app/auth/exceptions/oidc-service-unavailable.exception';

import type { Env } from '@/app/config/env.schema';

@Injectable()
export class OidcDiscoveryService {
  private issuer: string | null = null;
  private jwksFunction: ReturnType<typeof createRemoteJWKSet> | null = null;

  constructor(private readonly configService: ConfigService<Env, true>) {}

  async init(): Promise<void> {
    // Read here, not in the constructor: with FAKE_AUTH these are unset and
    // init() is never called.
    const discoveryUrl = this.configService.get('AUTH_OIDC_DISCOVERY_URL', {
      infer: true,
    });
    const clientId = this.configService.get('AUTH_CLIENT_ID', {
      infer: true,
    });
    if (!discoveryUrl || !clientId) {
      throw new Error(
        'AUTH_OIDC_DISCOVERY_URL and AUTH_CLIENT_ID are required',
      );
    }

    try {
      const config = await oidc.discovery(
        new URL(discoveryUrl),
        clientId,
        undefined,
        oidc.None(),
        {
          timeout: 30,
        },
      );

      const serverMetadata = config.serverMetadata();

      if (!serverMetadata.issuer || !serverMetadata.jwks_uri) {
        throw new Error('Invalid OIDC configuration: missing required fields');
      }

      this.issuer = serverMetadata.issuer;

      this.jwksFunction = createRemoteJWKSet(new URL(serverMetadata.jwks_uri));
    } catch {
      throw new OidcServiceUnavailableException(
        'Failed to initialize OIDC discovery service',
      );
    }
  }

  getJWKSet(): ReturnType<typeof createRemoteJWKSet> {
    if (!this.jwksFunction) {
      throw new OidcServiceUnavailableException(
        'OidcDiscoveryService not initialized. Call init() during bootstrap.',
      );
    }
    return this.jwksFunction;
  }

  getIssuer(): string {
    if (!this.issuer) {
      throw new OidcServiceUnavailableException(
        'OidcDiscoveryService not initialized. Call init() during bootstrap.',
      );
    }
    return this.issuer;
  }

  isInitialized(): boolean {
    return this.issuer !== null && this.jwksFunction !== null;
  }
}
