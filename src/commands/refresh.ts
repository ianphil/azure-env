import type { CancellationToken, EnvironmentVariableCollection } from 'vscode';
import type { AppConfigService } from '../services/appConfigService';
import type { KeyVaultService } from '../services/keyVaultService';
import {
  transformKeyToEnvVar,
  isKeyVaultReference,
  parseKeyVaultReference,
} from '../models/configValue';
import { AzureEnvError } from '../errors';
import type { ProgressReporter } from '../ui/progress';

export interface RefreshOptions {
  selectedKeys: string[];
  label: string;
  envCollection: EnvironmentVariableCollection;
  appConfigService: AppConfigService;
  keyVaultService: KeyVaultService;
  /** Optional progress reporter for UI feedback */
  progress?: ProgressReporter;
  /** Optional cancellation token */
  cancellationToken?: CancellationToken;
}

export interface RefreshError {
  key: string;
  error: AzureEnvError | Error;
}

export interface RefreshResult {
  succeeded: number;
  failed: number;
  errors: RefreshError[];
}

/**
 * Refresh environment variables by fetching values from App Configuration
 * and resolving any Key Vault references.
 */
export async function refreshEnvironment(options: RefreshOptions): Promise<RefreshResult> {
  const {
    selectedKeys,
    label,
    envCollection,
    appConfigService,
    keyVaultService,
    progress,
    cancellationToken,
  } = options;

  // Clear existing environment variables
  envCollection.clear();

  const result: RefreshResult = {
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  const totalKeys = selectedKeys.length;
  const incrementPerKey = totalKeys > 0 ? 100 / totalKeys : 100;

  for (const key of selectedKeys) {
    // Check for cancellation
    if (cancellationToken?.isCancellationRequested) {
      break;
    }

    // Report progress
    progress?.report({
      message: `Fetching ${key}`,
      increment: incrementPerKey,
    });

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
