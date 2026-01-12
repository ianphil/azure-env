import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppConfigService } from '../../src/services/appConfigService';

const { mockListConfigurationSettings, mockGetConfigurationSetting, MockAppConfigurationClient } =
  vi.hoisted(() => {
    const mocks = {
      mockListConfigurationSettings: vi.fn(),
      mockGetConfigurationSetting: vi.fn(),
    };

    class MockAppConfigurationClient {
      listConfigurationSettings(...args: unknown[]) {
        return mocks.mockListConfigurationSettings(...args);
      }
      getConfigurationSetting(...args: unknown[]) {
        return mocks.mockGetConfigurationSetting(...args);
      }
    }

    return { ...mocks, MockAppConfigurationClient };
  });

vi.mock('@azure/app-configuration', () => ({
  AppConfigurationClient: MockAppConfigurationClient,
}));

describe('AppConfigService', () => {
  let service: AppConfigService;
  let mockCredential: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCredential = {};
    mockListConfigurationSettings.mockReset();
    mockGetConfigurationSetting.mockReset();
    service = new AppConfigService('https://test.azconfig.io', mockCredential);
  });

  describe('listSettings', () => {
    it('fetches settings with key filter and label', async () => {
      const mockSettings = [
        { key: 'App/Setting1', value: 'value1', contentType: 'text/plain' },
        {
          key: 'App/Setting2',
          value: '{"uri":"..."}',
          contentType: 'application/vnd.microsoft.appconfig.keyvaultref+json',
        },
      ];

      mockListConfigurationSettings.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          for (const setting of mockSettings) {
            yield setting;
          }
        },
      });

      const results = await service.listSettings({ keyFilter: 'App/*', labelFilter: 'dev' });

      expect(results).toHaveLength(2);
      expect(results[0].key).toBe('App/Setting1');
      expect(results[1].key).toBe('App/Setting2');
      expect(mockListConfigurationSettings).toHaveBeenCalledWith({
        keyFilter: 'App/*',
        labelFilter: 'dev',
      });
    });

    it('returns empty array when no settings found', async () => {
      mockListConfigurationSettings.mockReturnValue({
        async *[Symbol.asyncIterator]() {
          // yield nothing
        },
      });

      const results = await service.listSettings({});

      expect(results).toHaveLength(0);
    });
  });

  describe('getSetting', () => {
    it('fetches a single setting by key', async () => {
      mockGetConfigurationSetting.mockResolvedValue({
        key: 'App/Setting1',
        value: 'value1',
        contentType: 'text/plain',
      });

      const result = await service.getSetting('App/Setting1', 'dev');

      expect(result.value).toBe('value1');
      expect(mockGetConfigurationSetting).toHaveBeenCalledWith({
        key: 'App/Setting1',
        label: 'dev',
      });
    });

    it('fetches setting without label when label is empty', async () => {
      mockGetConfigurationSetting.mockResolvedValue({
        key: 'App/Setting1',
        value: 'value1',
      });

      await service.getSetting('App/Setting1', '');

      expect(mockGetConfigurationSetting).toHaveBeenCalledWith({
        key: 'App/Setting1',
        label: undefined,
      });
    });
  });

  describe('getSettings', () => {
    it('fetches multiple settings by keys', async () => {
      mockGetConfigurationSetting
        .mockResolvedValueOnce({ key: 'App/Key1', value: 'value1' })
        .mockResolvedValueOnce({ key: 'App/Key2', value: 'value2' });

      const results = await service.getSettings(['App/Key1', 'App/Key2'], 'dev');

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('fulfilled');
      expect((results[0] as PromiseFulfilledResult<{ key: string }>).value.key).toBe('App/Key1');
      expect((results[1] as PromiseFulfilledResult<{ key: string }>).value.key).toBe('App/Key2');
    });

    it('handles partial failures gracefully', async () => {
      mockGetConfigurationSetting
        .mockResolvedValueOnce({ key: 'App/Key1', value: 'value1' })
        .mockRejectedValueOnce(new Error('Not found'));

      const results = await service.getSettings(['App/Key1', 'App/Key2'], 'dev');

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
    });
  });
});
