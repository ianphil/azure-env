import { AzureEnvError } from './baseError';

/**
 * Error thrown when Azure rate limits are exceeded.
 */
export class RateLimitError extends AzureEnvError {
  readonly code = 'RATE_LIMIT_ERROR';
  readonly isRetryable = true;
  readonly statusCode = 429;

  constructor(
    public readonly service: 'AppConfig' | 'KeyVault',
    public readonly retryAfterMs?: number,
    cause?: Error
  ) {
    const message = retryAfterMs
      ? `Rate limited by ${service}. Retry after ${Math.ceil(retryAfterMs / 1000)} seconds.`
      : `Rate limited by ${service}. Please wait and try again.`;
    super(message, cause);
  }

  get userMessage(): string {
    if (this.retryAfterMs) {
      const seconds = Math.ceil(this.retryAfterMs / 1000);
      return `${this.service} rate limit exceeded. Please wait ${seconds} seconds before retrying.`;
    }
    return `${this.service} rate limit exceeded. Please wait before retrying.`;
  }
}

/**
 * Extract retry-after value from Azure SDK error response headers.
 * Returns milliseconds to wait, or undefined if not available.
 */
export function extractRetryAfter(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined;
  }

  // Azure SDK errors may have response.headers
  const errorObj = error as Record<string, unknown>;
  const response = errorObj.response as Record<string, unknown> | undefined;
  const headers = response?.headers as Record<string, unknown> | undefined;

  if (headers) {
    // Try different header access patterns
    let retryAfter: string | undefined;

    if (typeof headers.get === 'function') {
      retryAfter = (headers.get as (key: string) => string | undefined)('retry-after');
    } else {
      // Plain object headers - case-insensitive lookup
      const key = Object.keys(headers).find((k) => k.toLowerCase() === 'retry-after');
      if (key) {
        retryAfter = headers[key] as string;
      }
    }

    if (retryAfter) {
      const seconds = parseInt(retryAfter, 10);
      if (!isNaN(seconds)) {
        return seconds * 1000;
      }
    }
  }

  return undefined;
}

/**
 * Check if an error is a rate limit error (HTTP 429).
 */
export function isRateLimitError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false;
  }

  const statusCode = (error as { statusCode?: number }).statusCode;
  return statusCode === 429;
}
