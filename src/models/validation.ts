import { ValidationError } from '../errors';
import type { AzureEnvSettings } from './settings';

/**
 * Result of validating settings.
 */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/**
 * Validate Azure Env settings.
 * Returns validation result with any errors found.
 */
export function validateSettings(settings: AzureEnvSettings): ValidationResult {
  const errors: ValidationError[] = [];

  // Validate endpoint URL
  if (settings.endpoint) {
    try {
      const url = new URL(settings.endpoint);

      if (url.protocol !== 'https:') {
        errors.push(new ValidationError('endpoint', 'Endpoint must use HTTPS'));
      }

      if (!url.hostname.endsWith('.azconfig.io')) {
        errors.push(
          new ValidationError('endpoint', 'Endpoint must be an Azure App Configuration URL (*.azconfig.io)')
        );
      }
    } catch {
      errors.push(new ValidationError('endpoint', 'Invalid endpoint URL format'));
    }
  }

  // Validate selectedKeys
  if (settings.selectedKeys.length > 0) {
    for (let i = 0; i < settings.selectedKeys.length; i++) {
      const key = settings.selectedKeys[i];

      if (!key || key.trim() === '') {
        errors.push(new ValidationError('selectedKeys', `Key at index ${i} is empty`));
        continue;
      }

      // App Configuration key length limit is 10,000 characters
      if (key.length > 10000) {
        errors.push(
          new ValidationError('selectedKeys', `Key "${key.slice(0, 30)}..." exceeds maximum length`)
        );
      }

      // Keys cannot contain certain characters
      if (key.includes('%') || key.includes('*') || key.includes(',') || key.includes('\\')) {
        errors.push(
          new ValidationError(
            'selectedKeys',
            `Key "${key.slice(0, 30)}" contains invalid characters (%, *, ,, or \\)`
          )
        );
      }
    }
  }

  // Validate label format (optional, but if provided must be valid)
  if (settings.label) {
    // Labels cannot contain certain characters
    if (settings.label.includes('%') || settings.label.includes('*') || settings.label.includes(',')) {
      errors.push(
        new ValidationError('label', 'Label contains invalid characters (%, *, or ,)')
      );
    }
    if (settings.label.length > 256) {
      errors.push(new ValidationError('label', 'Label exceeds maximum length of 256 characters'));
    }
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

/**
 * Check if settings are configured (have required fields).
 */
export function isConfigured(settings: AzureEnvSettings): boolean {
  return !!settings.endpoint && settings.selectedKeys.length > 0;
}

/**
 * Format validation errors as a user-friendly message.
 */
export function formatValidationErrors(errors: ValidationError[]): string {
  if (errors.length === 0) {
    return '';
  }
  if (errors.length === 1) {
    return errors[0].userMessage;
  }
  return `Multiple validation errors:\n${errors.map((e) => `  - ${e.userMessage}`).join('\n')}`;
}
