import { describe, it, expect, beforeAll } from 'vitest';
import { AppConfigService } from '../../src/services/appConfigService';
import {
  shouldRunIntegrationTests,
  getIntegrationConfig,
  getCredential,
  IntegrationTestConfig,
  SEEDED_TEST_DATA,
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
    });

    it('filters settings by key pattern', async () => {
      const settings = await service.listSettings({ keyFilter: 'integration-test/*' });
      expect(Array.isArray(settings)).toBe(true);
      // Should find the seeded test data
      expect(settings.length).toBeGreaterThan(0);
    });

    it('handles label filter', async () => {
      const settings = await service.listSettings({
        keyFilter: '*',
        labelFilter: SEEDED_TEST_DATA.label,
      });
      expect(Array.isArray(settings)).toBe(true);
      // Should find seeded data with integration-test label
      expect(settings.length).toBeGreaterThan(0);
    });

    it('returns empty for non-existent key pattern', async () => {
      const settings = await service.listSettings({ keyFilter: 'nonexistent-prefix-*' });
      expect(Array.isArray(settings)).toBe(true);
      expect(settings.length).toBe(0);
    });
  });

  describe('getSetting', () => {
    it('retrieves a seeded plain config value', async () => {
      const setting = await service.getSetting(
        SEEDED_TEST_DATA.configKey,
        SEEDED_TEST_DATA.label
      );
      expect(setting.key).toBe(SEEDED_TEST_DATA.configKey);
      expect(setting.value).toBe(SEEDED_TEST_DATA.configValue);
    });

    it('retrieves a seeded Key Vault reference', async () => {
      const setting = await service.getSetting(
        SEEDED_TEST_DATA.keyVaultRefKey,
        SEEDED_TEST_DATA.label
      );
      expect(setting.key).toBe(SEEDED_TEST_DATA.keyVaultRefKey);
      // Key Vault references have a specific content type
      expect(setting.contentType).toContain('keyvaultref');
    });

    it('throws AppConfigError for non-existent key', async () => {
      const nonExistentKey = `${config.testKeyPrefix}/nonexistent`;
      await expect(service.getSetting(nonExistentKey, '')).rejects.toThrow();
    });
  });

  describe('getSettings (batch)', () => {
    it('retrieves multiple seeded settings', async () => {
      const keys = [SEEDED_TEST_DATA.configKey, SEEDED_TEST_DATA.keyVaultRefKey];
      const results = await service.getSettings(keys, SEEDED_TEST_DATA.label);
      expect(results).toHaveLength(2);
      // Both should succeed since they're seeded
      results.forEach((result) => {
        expect(result.status).toBe('fulfilled');
      });
    });

    it('handles mixed success and failure', async () => {
      const keys = [
        SEEDED_TEST_DATA.configKey,
        `${config.testKeyPrefix}/nonexistent`,
      ];
      const results = await service.getSettings(keys, SEEDED_TEST_DATA.label);
      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
    });

    it('handles all non-existent keys', async () => {
      const keys = [
        `${config.testKeyPrefix}/nonexistent-1`,
        `${config.testKeyPrefix}/nonexistent-2`,
      ];
      const results = await service.getSettings(keys, '');
      expect(results).toHaveLength(2);
      results.forEach((result) => {
        expect(result.status).toBe('rejected');
      });
    });
  });
});
