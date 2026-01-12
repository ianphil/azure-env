import type { EnvironmentVariableCollection } from 'vscode';
import type { AppConfigService } from '../services/appConfigService';
import type { KeyVaultService } from '../services/keyVaultService';
import { transformKeyToEnvVar, isKeyVaultReference, parseKeyVaultReference } from '../models/configValue';

export interface RefreshOptions {
  selectedKeys: string[];
  label: string;
  envCollection: EnvironmentVariableCollection;
  appConfigService: AppConfigService;
  keyVaultService: KeyVaultService;
}

export interface RefreshResult {
  succeeded: number;
  failed: number;
  errors: Array<{ key: string; error: Error }>;
}

/**
 * Refresh environment variables by fetching values from App Configuration
 * and resolving any Key Vault references.
 */
export async function refreshEnvironment(options: RefreshOptions): Promise<RefreshResult> {
  const { selectedKeys, label, envCollection, appConfigService, keyVaultService } = options;

  // Clear existing environment variables
  envCollection.clear();

  const result: RefreshResult = {
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  for (const key of selectedKeys) {
    try {
      // Fetch setting from App Configuration
      const setting = await appConfigService.getSetting(key, label);
      let value = setting.value ?? '';

      // Resolve Key Vault reference if needed
      if (isKeyVaultReference(setting.contentType)) {
        const secretUri = parseKeyVaultReference(value);
        value = await keyVaultService.resolveSecret(secretUri);
      }

      // Transform key to environment variable name and inject
      const envName = transformKeyToEnvVar(key);
      envCollection.replace(envName, value);
      result.succeeded++;
    } catch (error) {
      result.failed++;
      result.errors.push({ key, error: error as Error });
    }
  }

  return result;
}
