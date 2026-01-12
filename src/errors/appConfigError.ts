import { AzureEnvError } from './baseError';

/**
 * Error thrown when App Configuration operations fail.
 */
export class AppConfigError extends AzureEnvError {
  readonly code = 'APP_CONFIG_ERROR';

  constructor(
    message: string,
    public readonly key: string,
    public readonly label?: string,
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
      return `Configuration key "${this.key}" not found`;
    }
    if (this.statusCode === 403 || this.statusCode === 401) {
      return `Access denied to configuration key "${this.key}". Check your Azure RBAC permissions.`;
    }
    if (this.statusCode === 429) {
      return `Rate limited by App Configuration. Please wait and try again.`;
    }
    return `Failed to retrieve configuration key "${this.key}"`;
  }
}

/**
 * Error thrown when listing App Configuration stores fails.
 */
export class AppConfigListError extends AzureEnvError {
  readonly code = 'APP_CONFIG_LIST_ERROR';

  constructor(
    message: string,
    public readonly subscriptionId: string,
    cause?: Error
  ) {
    super(message, cause);
  }

  get isRetryable(): boolean {
    return this.statusCode === 429 || this.statusCode === 503 || this.statusCode === 500;
  }

  get userMessage(): string {
    if (this.statusCode === 403 || this.statusCode === 401) {
      return 'Access denied. Check your Azure RBAC permissions for listing App Configuration stores.';
    }
    return 'Failed to list App Configuration stores. Check your Azure connection.';
  }
}
