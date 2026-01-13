import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { EnvTreeProvider } from '../src/providers/envTreeProvider';
import { commands, window, mockExtensionContext } from 'vscode';

const ensureSignedInMock = vi.fn();
const getSubscriptionsMock = vi.fn();
const getSettingsMock = vi.fn();
const refreshEnvironmentMock = vi.fn();

vi.mock('../src/services/authService', () => ({
  AuthService: class {
    ensureSignedIn = ensureSignedInMock;
    getSubscriptions = getSubscriptionsMock;
    getProvider() {
      return { dispose: vi.fn() };
    }
  },
}));

vi.mock('../src/ui/statusBar', () => ({
  StatusBarManager: class {
    setState = vi.fn();
    dispose = vi.fn();
  },
}));

vi.mock('../src/models/settings', () => ({
  getSettings: getSettingsMock,
  saveSettings: vi.fn(),
}));

vi.mock('../src/commands/refresh', () => ({
  refreshEnvironment: refreshEnvironmentMock,
}));

vi.mock('../src/services/appConfigService', () => ({
  AppConfigService: class {},
}));

vi.mock('../src/services/keyVaultService', () => ({
  KeyVaultService: class {},
}));

vi.mock('../src/services/scopedCredential', () => ({
  ScopedCredential: class {},
}));

describe('extension activation', () => {
  beforeEach(() => {
    commands.registerCommand.mockReset();
    window.createTreeView.mockReset();
    mockExtensionContext.subscriptions.length = 0;
    ensureSignedInMock.mockReset();
    getSubscriptionsMock.mockReset();
    refreshEnvironmentMock.mockReset();
    getSettingsMock.mockReset();
    getSettingsMock.mockReturnValue({
      endpoint: '',
      selectedKeys: [],
      label: '',
      keyFilter: '*',
      subscriptionId: '',
      tenantId: '',
    });
  });

  it('creates tree view and registers tree commands', async () => {
    const commandMap = new Map<string, (...args: unknown[]) => unknown>();
    commands.registerCommand.mockImplementation((command, handler) => {
      commandMap.set(command, handler as (...args: unknown[]) => unknown);
      return { dispose: vi.fn() };
    });

    const { activate } = await import('../src/extension');
    await activate(mockExtensionContext as any);

    expect(window.createTreeView).toHaveBeenCalledWith(
      'azureEnv.environment',
      expect.objectContaining({ treeDataProvider: expect.anything() })
    );

    const registeredCommands = Array.from(commandMap.keys());
    expect(registeredCommands).toEqual(
      expect.arrayContaining([
        'azureEnv.connect',
        'azureEnv.refresh',
        'azureEnv.copyValue',
        'azureEnv.copyKey',
        'azureEnv.revealValue',
      ])
    );
  });

  it('updates tree provider after refresh', async () => {
    const commandMap = new Map<string, (...args: unknown[]) => unknown>();
    commands.registerCommand.mockImplementation((command, handler) => {
      commandMap.set(command, handler as (...args: unknown[]) => unknown);
      return { dispose: vi.fn() };
    });

    ensureSignedInMock.mockResolvedValue(true);
    getSubscriptionsMock.mockResolvedValue([
      { subscriptionId: 'sub-1', tenantId: 'tenant-1' },
    ]);

    refreshEnvironmentMock.mockResolvedValue({
      succeeded: 1,
      failed: 0,
      errors: [],
      items: [{ key: 'App/Key', value: 'value', isSecret: false }],
    });

    const { activate } = await import('../src/extension');
    await activate(mockExtensionContext as any);

    getSettingsMock.mockReturnValue({
      endpoint: 'https://example.azconfig.io',
      selectedKeys: ['App/Key'],
      label: '',
      keyFilter: '*',
      subscriptionId: 'sub-1',
      tenantId: 'tenant-1',
    });

    const refreshHandler = commandMap.get('azureEnv.refresh');
    if (!refreshHandler) {
      throw new Error('Refresh command was not registered');
    }

    await refreshHandler();

    const treeDataProvider = window.createTreeView.mock.calls[0][1]
      .treeDataProvider as EnvTreeProvider;
    const roots = treeDataProvider.getChildren();
    expect(roots).toHaveLength(1);
    expect(roots[0].label).toBe('App');
  });
});
