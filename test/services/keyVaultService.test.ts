import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeyVaultService } from '../../src/services/keyVaultService';

const { mockGetSecret, secretClientInstances, MockSecretClient } = vi.hoisted(() => {
  const state = {
    mockGetSecret: vi.fn(),
    secretClientInstances: { count: 0 },
  };

  class MockSecretClient {
    constructor() {
      state.secretClientInstances.count++;
    }
    getSecret(...args: unknown[]) {
      return state.mockGetSecret(...args);
    }
  }

  return { ...state, MockSecretClient };
});

vi.mock('@azure/keyvault-secrets', () => ({
  SecretClient: MockSecretClient,
}));

describe('KeyVaultService', () => {
  let service: KeyVaultService;
  let mockCredential: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCredential = {};
    mockGetSecret.mockReset().mockResolvedValue({ value: 'secret-value' });
    secretClientInstances.count = 0;
    service = new KeyVaultService(mockCredential);
  });

  describe('resolveSecret', () => {
    it('fetches secret from Key Vault', async () => {
      const result = await service.resolveSecret(
        'https://myvault.vault.azure.net/secrets/MySecret'
      );

      expect(result).toBe('secret-value');
      expect(mockGetSecret).toHaveBeenCalledWith('MySecret', { version: undefined });
    });

    it('fetches secret with specific version', async () => {
      await service.resolveSecret('https://myvault.vault.azure.net/secrets/MySecret/abc123');

      expect(mockGetSecret).toHaveBeenCalledWith('MySecret', { version: 'abc123' });
    });

    it('caches clients by vault URL', async () => {
      await service.resolveSecret('https://vault1.vault.azure.net/secrets/Secret1');
      await service.resolveSecret('https://vault1.vault.azure.net/secrets/Secret2');

      // SecretClient should only be instantiated once for the same vault
      expect(secretClientInstances.count).toBe(1);
    });

    it('creates separate clients for different vaults', async () => {
      await service.resolveSecret('https://vault1.vault.azure.net/secrets/Secret1');
      await service.resolveSecret('https://vault2.vault.azure.net/secrets/Secret2');

      expect(secretClientInstances.count).toBe(2);
    });

    it('returns empty string if secret value is undefined', async () => {
      mockGetSecret.mockResolvedValue({ value: undefined });

      const result = await service.resolveSecret(
        'https://myvault.vault.azure.net/secrets/MySecret'
      );

      expect(result).toBe('');
    });
  });

  describe('resolveSecrets', () => {
    it('resolves multiple secrets in parallel', async () => {
      const uris = [
        'https://vault.vault.azure.net/secrets/Secret1',
        'https://vault.vault.azure.net/secrets/Secret2',
      ];

      const results = await service.resolveSecrets(uris);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');
    });

    it('handles partial failures gracefully', async () => {
      mockGetSecret
        .mockResolvedValueOnce({ value: 'value1' })
        .mockRejectedValueOnce(new Error('Access denied'));

      const uris = [
        'https://vault.vault.azure.net/secrets/Secret1',
        'https://vault.vault.azure.net/secrets/Secret2',
      ];

      const results = await service.resolveSecrets(uris);

      expect(results[0].status).toBe('fulfilled');
      expect((results[0] as PromiseFulfilledResult<string>).value).toBe('value1');
      expect(results[1].status).toBe('rejected');
    });
  });
});
