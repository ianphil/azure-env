import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../src/services/authService';

const { mockProvider, MockVSCodeAzureSubscriptionProvider } = vi.hoisted(() => {
  const mockProvider = {
    isSignedIn: vi.fn(),
    signIn: vi.fn(),
    getSubscriptions: vi.fn(),
  };

  class MockVSCodeAzureSubscriptionProvider {
    isSignedIn = mockProvider.isSignedIn;
    signIn = mockProvider.signIn;
    getSubscriptions = mockProvider.getSubscriptions;
  }

  return { mockProvider, MockVSCodeAzureSubscriptionProvider };
});

vi.mock('@microsoft/vscode-azext-azureauth', () => ({
  VSCodeAzureSubscriptionProvider: MockVSCodeAzureSubscriptionProvider,
}));

describe('AuthService', () => {
  let service: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    mockProvider.isSignedIn.mockReset();
    mockProvider.signIn.mockReset();
    mockProvider.getSubscriptions.mockReset();
    service = new AuthService();
  });

  describe('ensureSignedIn', () => {
    it('returns true if already signed in', async () => {
      mockProvider.isSignedIn.mockResolvedValue(true);

      const result = await service.ensureSignedIn();

      expect(result).toBe(true);
      expect(mockProvider.signIn).not.toHaveBeenCalled();
    });

    it('prompts sign-in if not signed in', async () => {
      mockProvider.isSignedIn.mockResolvedValue(false);
      mockProvider.signIn.mockResolvedValue(true);

      const result = await service.ensureSignedIn();

      expect(result).toBe(true);
      expect(mockProvider.signIn).toHaveBeenCalled();
    });

    it('returns false if sign-in is cancelled', async () => {
      mockProvider.isSignedIn.mockResolvedValue(false);
      mockProvider.signIn.mockResolvedValue(false);

      const result = await service.ensureSignedIn();

      expect(result).toBe(false);
    });
  });

  describe('getSubscriptions', () => {
    it('returns list of subscriptions', async () => {
      const mockSubscriptions = [
        { name: 'Sub1', subscriptionId: 'sub-1', credential: {} },
        { name: 'Sub2', subscriptionId: 'sub-2', credential: {} },
      ];
      mockProvider.getSubscriptions.mockResolvedValue(mockSubscriptions);

      const result = await service.getSubscriptions();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Sub1');
      expect(result[1].subscriptionId).toBe('sub-2');
    });

    it('returns empty array when no subscriptions', async () => {
      mockProvider.getSubscriptions.mockResolvedValue([]);

      const result = await service.getSubscriptions();

      expect(result).toHaveLength(0);
    });
  });

  describe('getProvider', () => {
    it('returns the subscription provider for disposal', () => {
      const provider = service.getProvider();
      expect(provider).toBeDefined();
    });
  });
});
