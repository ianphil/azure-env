import { AzureEnvError } from './baseError';

/**
 * Error thrown when Key Vault operations fail.
 */
export class KeyVaultError extends AzureEnvError {
  readonly code = 'KEY_VAULT_ERROR';

  constructor(
    message: string,
    public readonly secretUri: string,
    cause?: Error
  ) {
    super(message, cause);
  }

  get isRetryable(): boolean {
    // 429 = rate limited, 503 = service unavailable, 500 = server error
    return this.statusCode === 429 || this.statusCode === 503 || this.statusCode === 500;
  }

  get userMessage(): string {
    if (this.statusCode === 404) {
      return `Secret not found: ${this.secretUri}`;
    }
    if (this.statusCode === 403 || this.statusCode === 401) {
      return `Access denied to Key Vault secret. Check your Azure RBAC permissions.`;
    }
    if (this.statusCode === 429) {
      return `Rate limited by Key Vault. Please wait and try again.`;
    }
    return `Failed to retrieve secret from Key Vault`;
  }
}

/**
 * Error thrown when parsing Key Vault references fails.
 */
export class KeyVaultReferenceError extends AzureEnvError {
  readonly code = 'KEY_VAULT_REFERENCE_ERROR';
  readonly isRetryable = false;

  constructor(
    message: string,
    public readonly value: string,
    public readonly reason: 'invalid_json' | 'missing_uri' | 'invalid_uri'
  ) {
    super(message);
  }

  get userMessage(): string {
    switch (this.reason) {
      case 'invalid_json':
        return 'Invalid Key Vault reference format: not valid JSON';
      case 'missing_uri':
        return 'Invalid Key Vault reference: missing URI field';
      case 'invalid_uri':
        return 'Invalid Key Vault URI format';
      default:
        return this.message;
    }
  }
}
