import { describe, it, expect, beforeAll } from 'vitest';
import { AppConfigService } from '../../src/services/appConfigService';
import {
  shouldRunIntegrationTests,
  getIntegrationConfig,
  getCredential,
  IntegrationTestConfig,
} from './setup';

describe.skipIf(!shouldRunIntegrationTests())('AppConfigService Integration', () => {
  let service: AppConfigService;
  let config: IntegrationTestConfig;

  beforeAll(() => {
    config = getIntegrationConfig();
    service = new AppConfigService(config.appConfigEndpoint, getCredential());
  });

  describe('listSettings', () => {
    it('lists settings from real App Configuration', async () => {
      const settings = await service.listSettings({ keyFilter: '*' });
      expect(Array.isArray(settings)).toBe(true);
      // Should return at least an empty array
    });

    it('filters settings by key pattern', async () => {
      const settings = await service.listSettings({ keyFilter: 'nonexistent-prefix-*' });
      expect(Array.isArray(settings)).toBe(true);
      // May return empty if no keys match
    });

    it('handles label filter', async () => {
      const settings = await service.listSettings({
        keyFilter: '*',
        labelFilter: 'integration-test',
      });
      expect(Array.isArray(settings)).toBe(true);
    });
  });

  describe('getSetting', () => {
    // Note: This test requires a key to exist in your App Configuration
    // If you don't have test keys, this will throw AppConfigError with 404

    it.skip('retrieves a specific setting by key', async () => {
      // Update this with a real key from your App Configuration
      const testKey = 'your-test-key';
      const setting = await service.getSetting(testKey, '');
      expect(setting.key).toBe(testKey);
    });

    it('throws AppConfigError for non-existent key', async () => {
      const nonExistentKey = `${config.testKeyPrefix}/nonexistent`;
      await expect(service.getSetting(nonExistentKey, '')).rejects.toThrow();
    });
  });

  describe('getSettings (batch)', () => {
    it('handles batch requests with Promise.allSettled', async () => {
      const keys = [
        `${config.testKeyPrefix}/key1`,
        `${config.testKeyPrefix}/key2`,
      ];
      const results = await service.getSettings(keys, '');
      expect(results).toHaveLength(2);
      // All should be rejected since keys don't exist
      results.forEach((result) => {
        expect(result.status).toBe('rejected');
      });
    });
  });
});
