import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createRemoteJWKSet } from 'jose';
import * as oidc from 'openid-client';

import { OidcServiceUnavailableException } from '@/app/auth/exceptions/oidc-service-unavailable.errors';

import type { Env } from '@/app/config';

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
      const discoveryEndpoint = new URL(discoveryUrl);
      const isLocalTestProvider =
        this.configService.get('NODE_ENV', { infer: true }) !== 'production' &&
        ['localhost', '127.0.0.1', '[::1]'].includes(
          discoveryEndpoint.hostname,
        );
      const config = await oidc.discovery(
        discoveryEndpoint,
        clientId,
        undefined,
        oidc.None(),
        {
          timeout: 30,
          ...(isLocalTestProvider && {
            // eslint-disable-next-line @typescript-eslint/no-deprecated -- HTTP is intentional only for non-production loopback providers.
            execute: [oidc.allowInsecureRequests],
          }),
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
