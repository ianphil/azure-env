import { describe, it, expect } from 'vitest';
import {
  validateSettings,
  isConfigured,
  formatValidationErrors,
} from '../../src/models/validation';
import { ValidationError } from '../../src/errors';
import type { AzureEnvSettings } from '../../src/models/settings';

function createSettings(overrides: Partial<AzureEnvSettings> = {}): AzureEnvSettings {
  return {
    endpoint: 'https://myconfig.azconfig.io',
    selectedKeys: ['MyApp/Setting1'],
    label: 'dev',
    keyFilter: '*',
    ...overrides,
  };
}

describe('validateSettings', () => {
  describe('endpoint validation', () => {
    it('accepts valid Azure App Configuration endpoint', () => {
      const result = validateSettings(createSettings());
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('accepts endpoint with no endpoint (not configured)', () => {
      const result = validateSettings(createSettings({ endpoint: '' }));
      expect(result.valid).toBe(true);
    });

    it('rejects non-HTTPS endpoint', () => {
      const result = validateSettings(createSettings({ endpoint: 'http://myconfig.azconfig.io' }));
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].field).toBe('endpoint');
      expect(result.errors[0].message).toContain('HTTPS');
    });

    it('rejects non-azconfig.io domain', () => {
      const result = validateSettings(createSettings({ endpoint: 'https://example.com' }));
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].message).toContain('azconfig.io');
    });

    it('rejects invalid URL format', () => {
      const result = validateSettings(createSettings({ endpoint: 'not-a-url' }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('Invalid endpoint URL');
    });
  });

  describe('selectedKeys validation', () => {
    it('accepts valid keys', () => {
      const result = validateSettings(
        createSettings({ selectedKeys: ['App/Setting1', 'App/Setting2'] })
      );
      expect(result.valid).toBe(true);
    });

    it('accepts empty keys array', () => {
      const result = validateSettings(createSettings({ selectedKeys: [] }));
      expect(result.valid).toBe(true);
    });

    it('rejects empty string in keys', () => {
      const result = validateSettings(createSettings({ selectedKeys: ['valid', ''] }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('selectedKeys');
      expect(result.errors[0].message).toContain('empty');
    });

    it('rejects whitespace-only keys', () => {
      const result = validateSettings(createSettings({ selectedKeys: ['  '] }));
      expect(result.valid).toBe(false);
    });

    it('rejects keys with invalid characters', () => {
      const invalidChars = ['key%1', 'key*2', 'key,3', 'key\\4'];
      for (const key of invalidChars) {
        const result = validateSettings(createSettings({ selectedKeys: [key] }));
        expect(result.valid).toBe(false);
        expect(result.errors[0].message).toContain('invalid characters');
      }
    });

    it('rejects excessively long keys', () => {
      const longKey = 'a'.repeat(10001);
      const result = validateSettings(createSettings({ selectedKeys: [longKey] }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('maximum length');
    });
  });

  describe('label validation', () => {
    it('accepts valid labels', () => {
      const result = validateSettings(createSettings({ label: 'dev' }));
      expect(result.valid).toBe(true);
    });

    it('accepts empty label', () => {
      const result = validateSettings(createSettings({ label: '' }));
      expect(result.valid).toBe(true);
    });

    it('rejects labels with invalid characters', () => {
      const result = validateSettings(createSettings({ label: 'dev%test' }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].field).toBe('label');
    });

    it('rejects excessively long labels', () => {
      const result = validateSettings(createSettings({ label: 'a'.repeat(257) }));
      expect(result.valid).toBe(false);
      expect(result.errors[0].message).toContain('maximum length');
    });
  });

  it('collects multiple errors', () => {
    const result = validateSettings({
      endpoint: 'http://example.com', // Two errors: not HTTPS and not azconfig.io
      selectedKeys: ['', 'key%invalid'], // Two errors: empty and invalid chars
      label: '%invalid',
      keyFilter: '*',
    });
    expect(result.valid).toBe(false);
    expect(result.errors.length).toBeGreaterThanOrEqual(4);
  });
});

describe('isConfigured', () => {
  it('returns true when endpoint and keys are set', () => {
    expect(isConfigured(createSettings())).toBe(true);
  });

  it('returns false when endpoint is empty', () => {
    expect(isConfigured(createSettings({ endpoint: '' }))).toBe(false);
  });

  it('returns false when selectedKeys is empty', () => {
    expect(isConfigured(createSettings({ selectedKeys: [] }))).toBe(false);
  });
});

describe('formatValidationErrors', () => {
  it('returns empty string for no errors', () => {
    expect(formatValidationErrors([])).toBe('');
  });

  it('returns single error message directly', () => {
    const errors = [new ValidationError('endpoint', 'Must be HTTPS')];
    expect(formatValidationErrors(errors)).toBe('Invalid endpoint: Must be HTTPS');
  });

  it('formats multiple errors as list', () => {
    const errors = [
      new ValidationError('endpoint', 'Must be HTTPS'),
      new ValidationError('label', 'Too long'),
    ];
    const result = formatValidationErrors(errors);
    expect(result).toContain('Multiple validation errors');
    expect(result).toContain('endpoint');
    expect(result).toContain('label');
  });
});
