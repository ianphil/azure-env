import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runConnectFlow, ConnectFlowDeps } from '../../src/commands/connect';

describe('runConnectFlow', () => {
  let mockAuthService: {
    ensureSignedIn: ReturnType<typeof vi.fn>;
    getSubscriptions: ReturnType<typeof vi.fn>;
  };
  let mockShowQuickPickSingle: ReturnType<typeof vi.fn>;
  let mockShowQuickPickMulti: ReturnType<typeof vi.fn>;
  let mockSaveSettings: ReturnType<typeof vi.fn>;
  let mockListStores: ReturnType<typeof vi.fn>;
  let mockListKeys: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockAuthService = {
      ensureSignedIn: vi.fn(),
      getSubscriptions: vi.fn(),
    };
    mockShowQuickPickSingle = vi.fn();
    mockShowQuickPickMulti = vi.fn();
    mockSaveSettings = vi.fn();
    mockListStores = vi.fn();
    mockListKeys = vi.fn();
  });

  function createDeps(overrides: Partial<ConnectFlowDeps> = {}): ConnectFlowDeps {
    return {
      authService: mockAuthService as any,
      showQuickPickSingle: mockShowQuickPickSingle,
      showQuickPickMulti: mockShowQuickPickMulti,
      saveSettings: mockSaveSettings,
      listStores: mockListStores,
      listKeys: mockListKeys,
      ...overrides,
    };
  }

  it('saves settings after successful flow', async () => {
    mockAuthService.ensureSignedIn.mockResolvedValue(true);
    mockAuthService.getSubscriptions.mockResolvedValue([
      { name: 'Sub1', subscriptionId: 'sub-1', credential: {} },
    ]);
    mockShowQuickPickSingle
      .mockResolvedValueOnce({ subscription: { subscriptionId: 'sub-1', credential: {} } }) // subscription
      .mockResolvedValueOnce({ endpoint: 'https://test.azconfig.io' }); // store
    mockShowQuickPickMulti.mockResolvedValueOnce([{ key: 'App/Key1' }, { key: 'App/Key2' }]); // keys
    mockListStores.mockResolvedValue([{ name: 'store', endpoint: 'https://test.azconfig.io' }]);
    mockListKeys.mockResolvedValue([{ key: 'App/Key1' }, { key: 'App/Key2' }]);

    const result = await runConnectFlow(createDeps());

    expect(result.success).toBe(true);
    expect(mockSaveSettings).toHaveBeenCalledWith({
      endpoint: 'https://test.azconfig.io',
      selectedKeys: ['App/Key1', 'App/Key2'],
    });
  });

  it('aborts if user cancels subscription picker', async () => {
    mockAuthService.ensureSignedIn.mockResolvedValue(true);
    mockAuthService.getSubscriptions.mockResolvedValue([{ name: 'Sub1' }]);
    mockShowQuickPickSingle.mockResolvedValue(undefined);

    const result = await runConnectFlow(createDeps());

    expect(result.success).toBe(false);
    expect(result.reason).toBe('cancelled');
    expect(mockSaveSettings).not.toHaveBeenCalled();
  });

  it('aborts if sign-in fails', async () => {
    mockAuthService.ensureSignedIn.mockResolvedValue(false);

    const result = await runConnectFlow(createDeps());

    expect(result.success).toBe(false);
    expect(result.reason).toBe('auth_failed');
    expect(mockSaveSettings).not.toHaveBeenCalled();
  });

  it('aborts if no subscriptions available', async () => {
    mockAuthService.ensureSignedIn.mockResolvedValue(true);
    mockAuthService.getSubscriptions.mockResolvedValue([]);

    const result = await runConnectFlow(createDeps());

    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_subscriptions');
  });

  it('aborts if user cancels store picker', async () => {
    mockAuthService.ensureSignedIn.mockResolvedValue(true);
    mockAuthService.getSubscriptions.mockResolvedValue([
      { name: 'Sub1', subscriptionId: 'sub-1', credential: {} },
    ]);
    mockShowQuickPickSingle
      .mockResolvedValueOnce({ subscription: { subscriptionId: 'sub-1', credential: {} } })
      .mockResolvedValueOnce(undefined); // cancelled store picker
    mockListStores.mockResolvedValue([{ name: 'store', endpoint: 'https://test.azconfig.io' }]);

    const result = await runConnectFlow(createDeps());

    expect(result.success).toBe(false);
    expect(result.reason).toBe('cancelled');
  });

  it('aborts if no stores available', async () => {
    mockAuthService.ensureSignedIn.mockResolvedValue(true);
    mockAuthService.getSubscriptions.mockResolvedValue([
      { name: 'Sub1', subscriptionId: 'sub-1', credential: {} },
    ]);
    mockShowQuickPickSingle.mockResolvedValueOnce({ subscription: { subscriptionId: 'sub-1', credential: {} } });
    mockListStores.mockResolvedValue([]);

    const result = await runConnectFlow(createDeps());

    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_stores');
  });

  it('aborts if user cancels key picker', async () => {
    mockAuthService.ensureSignedIn.mockResolvedValue(true);
    mockAuthService.getSubscriptions.mockResolvedValue([
      { name: 'Sub1', subscriptionId: 'sub-1', credential: {} },
    ]);
    mockShowQuickPickSingle
      .mockResolvedValueOnce({ subscription: { subscriptionId: 'sub-1', credential: {} } })
      .mockResolvedValueOnce({ endpoint: 'https://test.azconfig.io' });
    mockShowQuickPickMulti.mockResolvedValueOnce(undefined); // cancelled key picker
    mockListStores.mockResolvedValue([{ name: 'store', endpoint: 'https://test.azconfig.io' }]);
    mockListKeys.mockResolvedValue([{ key: 'App/Key1' }]);

    const result = await runConnectFlow(createDeps());

    expect(result.success).toBe(false);
    expect(result.reason).toBe('cancelled');
  });

  it('aborts if no keys selected', async () => {
    mockAuthService.ensureSignedIn.mockResolvedValue(true);
    mockAuthService.getSubscriptions.mockResolvedValue([
      { name: 'Sub1', subscriptionId: 'sub-1', credential: {} },
    ]);
    mockShowQuickPickSingle
      .mockResolvedValueOnce({ subscription: { subscriptionId: 'sub-1', credential: {} } })
      .mockResolvedValueOnce({ endpoint: 'https://test.azconfig.io' });
    mockShowQuickPickMulti.mockResolvedValueOnce([]); // empty selection
    mockListStores.mockResolvedValue([{ name: 'store', endpoint: 'https://test.azconfig.io' }]);
    mockListKeys.mockResolvedValue([{ key: 'App/Key1' }]);

    const result = await runConnectFlow(createDeps());

    expect(result.success).toBe(false);
    expect(result.reason).toBe('no_keys_selected');
  });

  it('returns selected endpoint on success', async () => {
    mockAuthService.ensureSignedIn.mockResolvedValue(true);
    mockAuthService.getSubscriptions.mockResolvedValue([
      { name: 'Sub1', subscriptionId: 'sub-1', credential: {} },
    ]);
    mockShowQuickPickSingle
      .mockResolvedValueOnce({ subscription: { subscriptionId: 'sub-1', credential: {} } })
      .mockResolvedValueOnce({ endpoint: 'https://mystore.azconfig.io', name: 'mystore' });
    mockShowQuickPickMulti.mockResolvedValueOnce([{ key: 'App/Key1' }]);
    mockListStores.mockResolvedValue([{ name: 'mystore', endpoint: 'https://mystore.azconfig.io' }]);
    mockListKeys.mockResolvedValue([{ key: 'App/Key1' }]);

    const result = await runConnectFlow(createDeps());

    expect(result.success).toBe(true);
    expect(result.endpoint).toBe('https://mystore.azconfig.io');
    expect(result.storeName).toBe('mystore');
  });
});
