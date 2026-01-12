import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refreshEnvironment, RefreshOptions } from '../../src/commands/refresh';

describe('refreshEnvironment', () => {
  let mockEnvCollection: {
    clear: ReturnType<typeof vi.fn>;
    replace: ReturnType<typeof vi.fn>;
  };
  let mockAppConfigService: {
    getSetting: ReturnType<typeof vi.fn>;
  };
  let mockKeyVaultService: {
    resolveSecret: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockEnvCollection = {
      clear: vi.fn(),
      replace: vi.fn(),
    };
    mockAppConfigService = {
      getSetting: vi.fn(),
    };
    mockKeyVaultService = {
      resolveSecret: vi.fn(),
    };
  });

  function createOptions(overrides: Partial<RefreshOptions> = {}): RefreshOptions {
    return {
      selectedKeys: ['App/Key'],
      label: 'dev',
      envCollection: mockEnvCollection as any,
      appConfigService: mockAppConfigService as any,
      keyVaultService: mockKeyVaultService as any,
      ...overrides,
    };
  }

  it('clears and repopulates environment collection', async () => {
    mockAppConfigService.getSetting.mockResolvedValue({
      key: 'App/Key',
      value: 'value',
      contentType: 'text/plain',
    });

    await refreshEnvironment(createOptions());

    expect(mockEnvCollection.clear).toHaveBeenCalled();
    expect(mockEnvCollection.replace).toHaveBeenCalledWith('APP_KEY', 'value');
  });

  it('transforms keys to environment variable format', async () => {
    mockAppConfigService.getSetting.mockResolvedValue({
      key: 'MyService/Database/Host',
      value: 'localhost',
      contentType: 'text/plain',
    });

    await refreshEnvironment(createOptions({ selectedKeys: ['MyService/Database/Host'] }));

    expect(mockEnvCollection.replace).toHaveBeenCalledWith('MYSERVICE_DATABASE_HOST', 'localhost');
  });

  it('resolves Key Vault references', async () => {
    mockAppConfigService.getSetting.mockResolvedValue({
      key: 'App/Secret',
      value: '{"uri":"https://vault.vault.azure.net/secrets/MySecret"}',
      contentType: 'application/vnd.microsoft.appconfig.keyvaultref+json',
    });
    mockKeyVaultService.resolveSecret.mockResolvedValue('resolved-secret');

    await refreshEnvironment(createOptions({ selectedKeys: ['App/Secret'] }));

    expect(mockKeyVaultService.resolveSecret).toHaveBeenCalledWith(
      'https://vault.vault.azure.net/secrets/MySecret'
    );
    expect(mockEnvCollection.replace).toHaveBeenCalledWith('APP_SECRET', 'resolved-secret');
  });

  it('continues on partial failures', async () => {
    mockAppConfigService.getSetting
      .mockResolvedValueOnce({ key: 'App/Key1', value: 'value1', contentType: 'text/plain' })
      .mockRejectedValueOnce(new Error('Not found'))
      .mockResolvedValueOnce({ key: 'App/Key3', value: 'value3', contentType: 'text/plain' });

    const result = await refreshEnvironment(
      createOptions({ selectedKeys: ['App/Key1', 'App/Key2', 'App/Key3'] })
    );

    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
    expect(result.errors).toHaveLength(1);
    expect(mockEnvCollection.replace).toHaveBeenCalledTimes(2);
  });

  it('returns zero counts when no keys selected', async () => {
    const result = await refreshEnvironment(createOptions({ selectedKeys: [] }));

    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(0);
    expect(mockEnvCollection.clear).toHaveBeenCalled();
  });

  it('handles Key Vault resolution failures', async () => {
    mockAppConfigService.getSetting.mockResolvedValue({
      key: 'App/Secret',
      value: '{"uri":"https://vault.vault.azure.net/secrets/MySecret"}',
      contentType: 'application/vnd.microsoft.appconfig.keyvaultref+json',
    });
    mockKeyVaultService.resolveSecret.mockRejectedValue(new Error('Access denied'));

    const result = await refreshEnvironment(createOptions({ selectedKeys: ['App/Secret'] }));

    expect(result.succeeded).toBe(0);
    expect(result.failed).toBe(1);
    expect(mockEnvCollection.replace).not.toHaveBeenCalled();
  });

  it('handles empty value gracefully', async () => {
    mockAppConfigService.getSetting.mockResolvedValue({
      key: 'App/Key',
      value: '',
      contentType: 'text/plain',
    });

    await refreshEnvironment(createOptions());

    expect(mockEnvCollection.replace).toHaveBeenCalledWith('APP_KEY', '');
  });

  it('handles undefined value gracefully', async () => {
    mockAppConfigService.getSetting.mockResolvedValue({
      key: 'App/Key',
      value: undefined,
      contentType: 'text/plain',
    });

    await refreshEnvironment(createOptions());

    expect(mockEnvCollection.replace).toHaveBeenCalledWith('APP_KEY', '');
  });
});
