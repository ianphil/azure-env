import { AppConfigurationClient, ConfigurationSetting } from '@azure/app-configuration';
import type { TokenCredential } from '@azure/identity';

export interface ListSettingsOptions {
  keyFilter?: string;
  labelFilter?: string;
}

export interface SettingResult {
  key: string;
  value: string;
  contentType?: string;
  status: 'fulfilled' | 'rejected';
  error?: Error;
}

/**
 * Service for interacting with Azure App Configuration.
 */
export class AppConfigService {
  private client: AppConfigurationClient;

  constructor(endpoint: string, credential: TokenCredential) {
    this.client = new AppConfigurationClient(endpoint, credential, {
      retryOptions: {
        maxRetries: 3,
        retryDelayInMs: 1000,
        maxRetryDelayInMs: 10000,
      },
    });
  }

  /**
   * List configuration settings with optional key and label filters.
   */
  async listSettings(options: ListSettingsOptions): Promise<ConfigurationSetting[]> {
    const settings: ConfigurationSetting[] = [];
    for await (const setting of this.client.listConfigurationSettings({
      keyFilter: options.keyFilter,
      labelFilter: options.labelFilter,
    })) {
      settings.push(setting);
    }
    return settings;
  }

  /**
   * Get a single configuration setting by key.
   */
  async getSetting(key: string, label: string): Promise<ConfigurationSetting> {
    return this.client.getConfigurationSetting({
      key,
      label: label || undefined,
    });
  }

  /**
   * Get multiple configuration settings by keys.
   * Returns PromiseSettledResult array to handle partial failures.
   */
  async getSettings(
    keys: string[],
    label: string
  ): Promise<PromiseSettledResult<ConfigurationSetting>[]> {
    return Promise.allSettled(keys.map((key) => this.getSetting(key, label)));
  }
}
