import { randomUUID } from 'node:crypto';

import type {
  OAuthClientInformationContext,
  OAuthClientMetadata,
  OAuthClientProvider,
  OAuthDiscoveryState,
  StoredOAuthClientInformation,
  StoredOAuthTokens,
} from '@modelcontextprotocol/client';

export class TestOAuthClientProvider implements OAuthClientProvider {
  readonly clientMetadata: OAuthClientMetadata;
  authorizationUrl?: URL;
  private expectedState?: string;
  private verifier?: string;
  private discovery?: OAuthDiscoveryState;
  private savedTokens?: StoredOAuthTokens;
  private readonly registrations = new Map<
    string,
    StoredOAuthClientInformation
  >();

  constructor(readonly redirectUrl: string) {
    this.clientMetadata = {
      client_name: 'Template API OAuth test client',
      redirect_uris: [redirectUrl],
      grant_types: ['authorization_code'],
      response_types: ['code'],
      token_endpoint_auth_method: 'none',
      application_type: 'native',
    };
  }

  state(): string {
    this.expectedState = randomUUID();
    return this.expectedState;
  }

  clientInformation(context?: OAuthClientInformationContext) {
    return context ? this.registrations.get(context.issuer) : undefined;
  }

  saveClientInformation(
    information: StoredOAuthClientInformation,
    context?: OAuthClientInformationContext,
  ): void {
    if (!context) throw new Error('Missing authorization-server identity');
    this.registrations.set(context.issuer, information);
  }

  tokens() {
    return this.savedTokens;
  }

  saveTokens(tokens: StoredOAuthTokens): void {
    this.savedTokens = tokens;
  }

  saveCodeVerifier(verifier: string): void {
    this.verifier = verifier;
  }

  codeVerifier(): string {
    if (!this.verifier) throw new Error('No PKCE verifier was saved');
    return this.verifier;
  }

  redirectToAuthorization(url: URL): void {
    this.authorizationUrl = url;
  }

  saveDiscoveryState(state: OAuthDiscoveryState): void {
    this.discovery = state;
  }

  discoveryState() {
    return this.discovery;
  }

  callbackParameters(callback: URL): URLSearchParams {
    const expected = new URL(this.redirectUrl);
    if (
      callback.origin !== expected.origin ||
      callback.pathname !== expected.pathname ||
      !this.expectedState ||
      callback.searchParams.get('state') !== this.expectedState
    ) {
      throw new Error('OAuth callback does not match the active authorization');
    }
    return callback.searchParams;
  }
}
