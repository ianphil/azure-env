import { describe, it, expect } from 'vitest';
import {
  transformKeyToEnvVar,
  isKeyVaultReference,
  parseKeyVaultReference,
  parseKeyVaultSecretUri,
} from '../../src/models/configValue';

describe('transformKeyToEnvVar', () => {
  it('converts slashes to underscores', () => {
    expect(transformKeyToEnvVar('MyService/Database/Host')).toBe('MYSERVICE_DATABASE_HOST');
  });

  it('uppercases the entire key', () => {
    expect(transformKeyToEnvVar('lowercase')).toBe('LOWERCASE');
  });

  it('handles keys without slashes', () => {
    expect(transformKeyToEnvVar('SimpleKey')).toBe('SIMPLEKEY');
  });

  it('handles empty string', () => {
    expect(transformKeyToEnvVar('')).toBe('');
  });

  it('handles keys with multiple consecutive slashes', () => {
    expect(transformKeyToEnvVar('a//b')).toBe('A__B');
  });
});

describe('isKeyVaultReference', () => {
  it('returns true for Key Vault reference content type', () => {
    const contentType = 'application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8';
    expect(isKeyVaultReference(contentType)).toBe(true);
  });

  it('returns false for plain text content type', () => {
    expect(isKeyVaultReference('text/plain')).toBe(false);
  });

  it('returns false for undefined content type', () => {
    expect(isKeyVaultReference(undefined)).toBe(false);
  });

  it('returns true for content type without charset', () => {
    const contentType = 'application/vnd.microsoft.appconfig.keyvaultref+json';
    expect(isKeyVaultReference(contentType)).toBe(true);
  });
});

describe('parseKeyVaultReference', () => {
  it('extracts URI from valid reference JSON', () => {
    const value = '{"uri":"https://myvault.vault.azure.net/secrets/MySecret"}';
    expect(parseKeyVaultReference(value)).toBe('https://myvault.vault.azure.net/secrets/MySecret');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseKeyVaultReference('not json')).toThrow();
  });

  it('throws on missing uri field', () => {
    expect(() => parseKeyVaultReference('{}')).toThrow('Missing uri');
  });
});

describe('parseKeyVaultSecretUri', () => {
  it('extracts vault URL and secret name', () => {
    const uri = 'https://myvault.vault.azure.net/secrets/MySecret';
    const result = parseKeyVaultSecretUri(uri);
    expect(result.vaultUrl).toBe('https://myvault.vault.azure.net');
    expect(result.secretName).toBe('MySecret');
  });

  it('handles URI with version', () => {
    const uri = 'https://myvault.vault.azure.net/secrets/MySecret/abc123';
    const result = parseKeyVaultSecretUri(uri);
    expect(result.secretName).toBe('MySecret');
    expect(result.version).toBe('abc123');
  });

  it('throws on invalid URI', () => {
    expect(() => parseKeyVaultSecretUri('not-a-url')).toThrow();
  });

  it('throws on non-secret URI', () => {
    expect(() => parseKeyVaultSecretUri('https://myvault.vault.azure.net/keys/MyKey')).toThrow('Invalid Key Vault secret URI');
  });
});
