import { AzureEnvError } from './baseError';

/**
 * Error thrown when settings validation fails.
 */
export class ValidationError extends AzureEnvError {
  readonly code = 'VALIDATION_ERROR';
  readonly isRetryable = false;

  constructor(
    public readonly field: string,
    message: string
  ) {
    super(message);
  }

  get userMessage(): string {
    return `Invalid ${this.field}: ${this.message}`;
  }
}

/**
 * Error thrown when authentication fails.
 */
export class AuthenticationError extends AzureEnvError {
  readonly code = 'AUTHENTICATION_ERROR';

  constructor(
    message: string,
    public readonly reason: 'not_signed_in' | 'sign_in_failed' | 'no_subscriptions' | 'cancelled',
    cause?: Error
  ) {
    super(message, cause);
  }

  get isRetryable(): boolean {
    // User can retry signing in, but cancellation is intentional
    return this.reason !== 'cancelled';
  }

  get userMessage(): string {
    switch (this.reason) {
      case 'not_signed_in':
        return 'Please sign in to your Microsoft account in VS Code';
      case 'sign_in_failed':
        return 'Failed to sign in. Please try again.';
      case 'no_subscriptions':
        return 'No Azure subscriptions found. Check your account has active subscriptions.';
      case 'cancelled':
        return 'Sign in was cancelled';
      default:
        return this.message;
    }
  }
}
