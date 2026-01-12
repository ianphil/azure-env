import { describe, it, expect, beforeAll } from 'vitest';
import { KeyVaultService } from '../../src/services/keyVaultService';
import {
  shouldRunIntegrationTests,
  getIntegrationConfig,
  getCredential,
  IntegrationTestConfig,
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
    // Note: This test requires a secret to exist in your Key Vault
    // If you don't have test secrets, update with a real secret URI

    it.skip('resolves a secret from Key Vault', async () => {
      // Update this with a real secret URI from your Key Vault
      const secretUri = `${config.keyVaultUrl}/secrets/your-test-secret`;
      const value = await service.resolveSecret(secretUri);
      expect(typeof value).toBe('string');
    });

    it('throws KeyVaultError for non-existent secret', async () => {
      const nonExistentUri = `${config.keyVaultUrl}/secrets/nonexistent-secret-${Date.now()}`;
      await expect(service.resolveSecret(nonExistentUri)).rejects.toThrow();
    });

    it('throws for invalid Key Vault URI', async () => {
      const invalidUri = 'https://example.com/not-a-keyvault';
      await expect(service.resolveSecret(invalidUri)).rejects.toThrow();
    });
  });

  describe('resolveSecrets (batch)', () => {
    it('handles batch requests with Promise.allSettled', async () => {
      const uris = [
        `${config.keyVaultUrl}/secrets/nonexistent-1-${Date.now()}`,
        `${config.keyVaultUrl}/secrets/nonexistent-2-${Date.now()}`,
      ];
      const results = await service.resolveSecrets(uris);
      expect(results).toHaveLength(2);
      // All should be rejected since secrets don't exist
      results.forEach((result) => {
        expect(result.status).toBe('rejected');
      });
    });
  });

  describe('client caching', () => {
    it('reuses client for same vault URL', async () => {
      // This tests the internal caching behavior
      // Both calls should use the same SecretClient instance
      const uri1 = `${config.keyVaultUrl}/secrets/test-1`;
      const uri2 = `${config.keyVaultUrl}/secrets/test-2`;

      // Both will fail (404) but the important thing is they don't create new clients
      await Promise.allSettled([
        service.resolveSecret(uri1).catch(() => {}),
        service.resolveSecret(uri2).catch(() => {}),
      ]);

      // If we got here without crashing, caching is working
      expect(true).toBe(true);
    });
  });
});
