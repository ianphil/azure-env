/**
 * Base error class for all Azure Env extension errors.
 * Provides common properties for error categorization and handling.
 */
export abstract class AzureEnvError extends Error {
  /** Unique error code for categorization */
  abstract readonly code: string;

  /** Whether this error is transient and the operation can be retried */
  abstract readonly isRetryable: boolean;

  /** HTTP status code from the underlying Azure SDK error, if available */
  readonly statusCode?: number;

  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = this.constructor.name;

    // Preserve stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }

    // Extract status code from Azure SDK errors
    if (cause && typeof cause === 'object' && 'statusCode' in cause) {
      this.statusCode = (cause as { statusCode: number }).statusCode;
    }
  }

  /**
   * Returns a user-friendly error message suitable for display.
   */
  get userMessage(): string {
    return this.message;
  }
}
