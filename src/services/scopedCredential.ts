import type { AccessToken, GetTokenOptions, TokenCredential } from '@azure/identity';
import type { AzureSubscription } from '@microsoft/vscode-azext-azureauth';

/**
 * A TokenCredential that uses VS Code's authentication with specific scopes.
 * This is needed because the default credential uses management.azure.com scope,
 * but data plane access (App Configuration, Key Vault) requires service-specific scopes.
 */
export class ScopedCredential implements TokenCredential {
  constructor(private subscription: AzureSubscription) {}

  async getToken(
    scopes: string | string[],
    _options?: GetTokenOptions
  ): Promise<AccessToken | null> {
    const scopeArray = Array.isArray(scopes) ? scopes : [scopes];

    const session = await this.subscription.authentication.getSessionWithScopes(scopeArray);

    if (!session) {
      return null;
    }

    // VS Code sessions don't provide expiration, use a reasonable default
    const expiresOnTimestamp = Date.now() + 3600 * 1000; // 1 hour from now

    return {
      token: session.accessToken,
      expiresOnTimestamp,
    };
  }
}
