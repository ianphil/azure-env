import { SecretClient } from '@azure/keyvault-secrets';
import type { TokenCredential } from '@azure/identity';
import { parseKeyVaultSecretUri } from '../models/configValue';
import {
  KeyVaultError,
  RateLimitError,
  isRateLimitError,
  extractRetryAfter,
} from '../errors';

/**
 * Service for resolving secrets from Azure Key Vault.
 * Caches SecretClient instances per vault URL for efficiency.
 */
export class KeyVaultService {
  private clients = new Map<string, SecretClient>();

  constructor(private credential: TokenCredential) {}

  /**
   * Get or create a SecretClient for the given vault URL.
   */
  private getClient(vaultUrl: string): SecretClient {
    let client = this.clients.get(vaultUrl);
    if (!client) {
      client = new SecretClient(vaultUrl, this.credential, {
        retryOptions: {
          maxRetries: 3,
          retryDelayInMs: 1000,
          maxRetryDelayInMs: 10000,
        },
      });
      this.clients.set(vaultUrl, client);
    }
    return client;
  }

  /**
   * Resolve a single secret from its Key Vault URI.
   *
   * @param uri Full secret URI (e.g., https://myvault.vault.azure.net/secrets/MySecret)
   * @returns The secret value
   */
  async resolveSecret(uri: string): Promise<string> {
    try {
      const { vaultUrl, secretName, version } = parseKeyVaultSecretUri(uri);
      const client = this.getClient(vaultUrl);
      const secret = await client.getSecret(secretName, { version });
      return secret.value ?? '';
    } catch (error) {
      // Re-throw if already a typed error (e.g., from parseKeyVaultSecretUri)
      if (error instanceof KeyVaultError) {
        throw error;
      }
      if (isRateLimitError(error)) {
        throw new RateLimitError('KeyVault', extractRetryAfter(error), error as Error);
      }
      throw new KeyVaultError(`Failed to resolve secret: ${uri}`, uri, error as Error);
    }
  }

  /**
   * Resolve multiple secrets in parallel.
   * Returns PromiseSettledResult array to handle partial failures.
   */
  async resolveSecrets(uris: string[]): Promise<PromiseSettledResult<string>[]> {
    return Promise.allSettled(uris.map((uri) => this.resolveSecret(uri)));
  }
}
