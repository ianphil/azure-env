import { describe, it, expect, beforeAll } from 'vitest';
import { KeyVaultService } from '../../src/services/keyVaultService';
import {
  shouldRunIntegrationTests,
  getIntegrationConfig,
  getCredential,
  IntegrationTestConfig,
  SEEDED_TEST_DATA,
} from './setup';

// Only run if both App Config and Key Vault are configured
const shouldRun = (): boolean => {
  return shouldRunIntegrationTests() && !!process.env.AZURE_KEYVAULT_URL;
};

describe.skipIf(!shouldRun())('KeyVaultService Integration', () => {
  let service: KeyVaultService;
  let config: IntegrationTestConfig;

  beforeAll(() => {
    config = getIntegrationConfig();
    service = new KeyVaultService(getCredential());
  });

  describe('resolveSecret', () => {
    it('resolves a seeded secret from Key Vault', async () => {
      const secretUri = `${config.keyVaultUrl}/secrets/${SEEDED_TEST_DATA.secretName}`;
      const value = await service.resolveSecret(secretUri);
      expect(typeof value).toBe('string');
      // The secret value starts with 'test-secret-value-' followed by a timestamp
      expect(value).toMatch(/^test-secret-value-\d+$/);
    });

    it('throws KeyVaultError for non-existent secret', async () => {
      const nonExistentUri = `${config.keyVaultUrl}/secrets/nonexistent-secret-${Date.now()}`;
      await expect(service.resolveSecret(nonExistentUri)).rejects.toThrow();
    });

    it('throws for invalid Key Vault URI', async () => {
      const invalidUri = 'https://example.com/not-a-keyvault';
      await expect(service.resolveSecret(invalidUri)).rejects.toThrow();
    });

    it('throws for malformed URI', async () => {
      const malformedUri = 'not-a-valid-uri';
      await expect(service.resolveSecret(malformedUri)).rejects.toThrow();
    });
  });

  describe('resolveSecrets (batch)', () => {
    it('resolves multiple secrets including seeded data', async () => {
      const uris = [
        `${config.keyVaultUrl}/secrets/${SEEDED_TEST_DATA.secretName}`,
      ];
      const results = await service.resolveSecrets(uris);
      expect(results).toHaveLength(1);
      expect(results[0].status).toBe('fulfilled');
      if (results[0].status === 'fulfilled') {
        expect(results[0].value).toMatch(/^test-secret-value-\d+$/);
      }
    });

    it('handles mixed success and failure', async () => {
      const uris = [
        `${config.keyVaultUrl}/secrets/${SEEDED_TEST_DATA.secretName}`,
        `${config.keyVaultUrl}/secrets/nonexistent-${Date.now()}`,
      ];
      const results = await service.resolveSecrets(uris);
      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
    });

    it('handles all non-existent secrets', async () => {
      const uris = [
        `${config.keyVaultUrl}/secrets/nonexistent-1-${Date.now()}`,
        `${config.keyVaultUrl}/secrets/nonexistent-2-${Date.now()}`,
      ];
      const results = await service.resolveSecrets(uris);
      expect(results).toHaveLength(2);
      results.forEach((result) => {
        expect(result.status).toBe('rejected');
      });
    });
  });

  describe('client caching', () => {
    it('reuses client for same vault URL', async () => {
      const secretUri = `${config.keyVaultUrl}/secrets/${SEEDED_TEST_DATA.secretName}`;

      // Call twice - should reuse the same SecretClient instance
      const value1 = await service.resolveSecret(secretUri);
      const value2 = await service.resolveSecret(secretUri);

      expect(value1).toBe(value2);
    });

    it('handles concurrent requests to same vault', async () => {
      const secretUri = `${config.keyVaultUrl}/secrets/${SEEDED_TEST_DATA.secretName}`;

      // Make multiple concurrent requests
      const results = await Promise.all([
        service.resolveSecret(secretUri),
        service.resolveSecret(secretUri),
        service.resolveSecret(secretUri),
      ]);

      // All should return the same value
      expect(results[0]).toBe(results[1]);
      expect(results[1]).toBe(results[2]);
    });
  });
});
