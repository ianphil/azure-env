import { describe, it, expect } from 'vitest';
import {
  AppConfigError,
  AppConfigListError,
  KeyVaultError,
  KeyVaultReferenceError,
  ValidationError,
  AuthenticationError,
  RateLimitError,
  extractRetryAfter,
  isRateLimitError,
} from '../../src/errors';

describe('AppConfigError', () => {
  it('captures key and label context', () => {
    const error = new AppConfigError('Failed to get setting', 'MyApp/Database/Host', 'dev');
    expect(error.key).toBe('MyApp/Database/Host');
    expect(error.label).toBe('dev');
    expect(error.code).toBe('APP_CONFIG_ERROR');
  });

  it('extracts status code from cause', () => {
    const cause = new Error('Not found') as Error & { statusCode: number };
    cause.statusCode = 404;
    const error = new AppConfigError('Failed', 'key', 'label', cause);
    expect(error.statusCode).toBe(404);
  });

  it('is retryable for 429, 500, 503', () => {
    const create = (statusCode: number) => {
      const cause = new Error('fail') as Error & { statusCode: number };
      cause.statusCode = statusCode;
      return new AppConfigError('fail', 'key', undefined, cause);
    };

    expect(create(429).isRetryable).toBe(true);
    expect(create(500).isRetryable).toBe(true);
    expect(create(503).isRetryable).toBe(true);
    expect(create(404).isRetryable).toBe(false);
    expect(create(403).isRetryable).toBe(false);
  });

  it('provides user-friendly messages based on status code', () => {
    const create = (statusCode: number) => {
      const cause = new Error('fail') as Error & { statusCode: number };
      cause.statusCode = statusCode;
      return new AppConfigError('fail', 'MyKey', undefined, cause);
    };

    expect(create(404).userMessage).toContain('not found');
    expect(create(403).userMessage).toContain('Access denied');
    expect(create(429).userMessage).toContain('Rate limited');
  });
});

describe('AppConfigListError', () => {
  it('captures subscription ID', () => {
    const error = new AppConfigListError('Failed to list stores', 'sub-123');
    expect(error.subscriptionId).toBe('sub-123');
    expect(error.code).toBe('APP_CONFIG_LIST_ERROR');
  });
});

describe('KeyVaultError', () => {
  it('captures secret URI', () => {
    const error = new KeyVaultError(
      'Failed to get secret',
      'https://vault.vault.azure.net/secrets/MySecret'
    );
    expect(error.secretUri).toBe('https://vault.vault.azure.net/secrets/MySecret');
    expect(error.code).toBe('KEY_VAULT_ERROR');
  });

  it('is retryable for transient errors', () => {
    const create = (statusCode: number) => {
      const cause = new Error('fail') as Error & { statusCode: number };
      cause.statusCode = statusCode;
      return new KeyVaultError('fail', 'uri', cause);
    };

    expect(create(429).isRetryable).toBe(true);
    expect(create(503).isRetryable).toBe(true);
    expect(create(404).isRetryable).toBe(false);
  });
});

describe('KeyVaultReferenceError', () => {
  it('captures value and reason', () => {
    const error = new KeyVaultReferenceError('Invalid JSON', '{ bad json', 'invalid_json');
    expect(error.value).toBe('{ bad json');
    expect(error.reason).toBe('invalid_json');
    expect(error.isRetryable).toBe(false);
  });

  it('provides user messages for each reason', () => {
    expect(new KeyVaultReferenceError('', '', 'invalid_json').userMessage).toContain(
      'not valid JSON'
    );
    expect(new KeyVaultReferenceError('', '', 'missing_uri').userMessage).toContain('missing URI');
    expect(new KeyVaultReferenceError('', '', 'invalid_uri').userMessage).toContain(
      'Invalid Key Vault URI'
    );
  });
});

describe('ValidationError', () => {
  it('captures field name', () => {
    const error = new ValidationError('endpoint', 'Must be HTTPS');
    expect(error.field).toBe('endpoint');
    expect(error.isRetryable).toBe(false);
    expect(error.userMessage).toBe('Invalid endpoint: Must be HTTPS');
  });
});

describe('AuthenticationError', () => {
  it('captures reason', () => {
    const error = new AuthenticationError('Not signed in', 'not_signed_in');
    expect(error.reason).toBe('not_signed_in');
    expect(error.code).toBe('AUTHENTICATION_ERROR');
  });

  it('is not retryable when cancelled', () => {
    expect(new AuthenticationError('Cancelled', 'cancelled').isRetryable).toBe(false);
    expect(new AuthenticationError('Failed', 'sign_in_failed').isRetryable).toBe(true);
    expect(new AuthenticationError('No subs', 'no_subscriptions').isRetryable).toBe(true);
  });

  it('provides user messages for each reason', () => {
    expect(new AuthenticationError('', 'not_signed_in').userMessage).toContain('sign in');
    expect(new AuthenticationError('', 'no_subscriptions').userMessage).toContain(
      'No Azure subscriptions'
    );
    expect(new AuthenticationError('', 'cancelled').userMessage).toContain('cancelled');
  });
});

describe('RateLimitError', () => {
  it('captures service and retry info', () => {
    const error = new RateLimitError('AppConfig', 5000);
    expect(error.service).toBe('AppConfig');
    expect(error.retryAfterMs).toBe(5000);
    expect(error.isRetryable).toBe(true);
    expect(error.statusCode).toBe(429);
  });

  it('formats message with retry time', () => {
    const error = new RateLimitError('KeyVault', 30000);
    expect(error.message).toContain('30 seconds');
    expect(error.userMessage).toContain('30 seconds');
  });

  it('handles missing retry time', () => {
    const error = new RateLimitError('AppConfig');
    expect(error.message).toContain('wait and try again');
  });
});

describe('extractRetryAfter', () => {
  it('returns undefined for non-objects', () => {
    expect(extractRetryAfter(null)).toBeUndefined();
    expect(extractRetryAfter(undefined)).toBeUndefined();
    expect(extractRetryAfter('string')).toBeUndefined();
  });

  it('extracts from response.headers object', () => {
    const error = {
      response: {
        headers: {
          'retry-after': '30',
        },
      },
    };
    expect(extractRetryAfter(error)).toBe(30000);
  });

  it('extracts from response.headers with Retry-After key', () => {
    const error = {
      response: {
        headers: {
          'Retry-After': '60',
        },
      },
    };
    expect(extractRetryAfter(error)).toBe(60000);
  });

  it('extracts from headers.get function', () => {
    const error = {
      response: {
        headers: {
          get: (key: string) => (key === 'retry-after' ? '45' : undefined),
        },
      },
    };
    expect(extractRetryAfter(error)).toBe(45000);
  });

  it('returns undefined when headers missing', () => {
    expect(extractRetryAfter({ response: {} })).toBeUndefined();
    expect(extractRetryAfter({})).toBeUndefined();
  });
});

describe('isRateLimitError', () => {
  it('detects 429 status code', () => {
    expect(isRateLimitError({ statusCode: 429 })).toBe(true);
    expect(isRateLimitError({ statusCode: 404 })).toBe(false);
    expect(isRateLimitError({ statusCode: 500 })).toBe(false);
  });

  it('returns false for non-objects', () => {
    expect(isRateLimitError(null)).toBe(false);
    expect(isRateLimitError(undefined)).toBe(false);
  });
});
