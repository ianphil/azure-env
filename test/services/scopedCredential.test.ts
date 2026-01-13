import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ScopedCredential } from '../../src/services/scopedCredential';
import type { AzureSubscription } from '@microsoft/vscode-azext-azureauth';

describe('ScopedCredential', () => {
  let mockSubscription: AzureSubscription;
  let mockGetSessionWithScopes: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockGetSessionWithScopes = vi.fn();
    mockSubscription = {
      authentication: {
        getSession: vi.fn(),
        getSessionWithScopes: mockGetSessionWithScopes,
      },
      environment: {} as AzureSubscription['environment'],
      isCustomCloud: false,
      name: 'Test Subscription',
      subscriptionId: 'test-sub-id',
      tenantId: 'test-tenant-id',
      credential: {} as AzureSubscription['credential'],
      account: { id: 'test-account', label: 'test@example.com' },
    } as AzureSubscription;
  });

  describe('getToken', () => {
    it('passes scopes array to getSessionWithScopes', async () => {
      const mockSession = {
        accessToken: 'test-token-123',
        id: 'session-id',
        account: { id: 'test-account', label: 'test@example.com' },
        scopes: ['https://azconfig.io/.default'],
      };
      mockGetSessionWithScopes.mockResolvedValue(mockSession);

      const credential = new ScopedCredential(mockSubscription);
      const result = await credential.getToken(['https://azconfig.io/.default']);

      expect(mockGetSessionWithScopes).toHaveBeenCalledWith(['https://azconfig.io/.default']);
      expect(result).not.toBeNull();
      expect(result?.token).toBe('test-token-123');
    });

    it('converts string scope to array', async () => {
      const mockSession = {
        accessToken: 'test-token-456',
        id: 'session-id',
        account: { id: 'test-account', label: 'test@example.com' },
        scopes: ['https://vault.azure.net/.default'],
      };
      mockGetSessionWithScopes.mockResolvedValue(mockSession);

      const credential = new ScopedCredential(mockSubscription);
      await credential.getToken('https://vault.azure.net/.default');

      expect(mockGetSessionWithScopes).toHaveBeenCalledWith(['https://vault.azure.net/.default']);
    });

    it('returns null when no session is available', async () => {
      mockGetSessionWithScopes.mockResolvedValue(undefined);

      const credential = new ScopedCredential(mockSubscription);
      const result = await credential.getToken(['https://azconfig.io/.default']);

      expect(result).toBeNull();
    });

    it('returns token with expiration timestamp', async () => {
      const mockSession = {
        accessToken: 'test-token-789',
        id: 'session-id',
        account: { id: 'test-account', label: 'test@example.com' },
        scopes: ['https://azconfig.io/.default'],
      };
      mockGetSessionWithScopes.mockResolvedValue(mockSession);

      const beforeTime = Date.now();
      const credential = new ScopedCredential(mockSubscription);
      const result = await credential.getToken(['https://azconfig.io/.default']);
      const afterTime = Date.now();

      expect(result).not.toBeNull();
      // Expiration should be approximately 1 hour from now
      const oneHourMs = 3600 * 1000;
      expect(result!.expiresOnTimestamp).toBeGreaterThanOrEqual(beforeTime + oneHourMs);
      expect(result!.expiresOnTimestamp).toBeLessThanOrEqual(afterTime + oneHourMs);
    });

    it('handles multiple scopes', async () => {
      const mockSession = {
        accessToken: 'multi-scope-token',
        id: 'session-id',
        account: { id: 'test-account', label: 'test@example.com' },
        scopes: ['scope1', 'scope2'],
      };
      mockGetSessionWithScopes.mockResolvedValue(mockSession);

      const credential = new ScopedCredential(mockSubscription);
      const scopes = ['https://azconfig.io/.default', 'https://vault.azure.net/.default'];
      await credential.getToken(scopes);

      expect(mockGetSessionWithScopes).toHaveBeenCalledWith(scopes);
    });
  });
});
