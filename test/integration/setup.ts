import { DefaultAzureCredential, TokenCredential } from '@azure/identity';

/**
 * Configuration for integration tests.
 * Requires environment variables to be set.
 */
export interface IntegrationTestConfig {
  /** App Configuration endpoint (e.g., https://myconfig.azconfig.io) */
  appConfigEndpoint: string;
  /** Key Vault URL (e.g., https://myvault.vault.azure.net) */
  keyVaultUrl: string;
  /** Prefix for test keys to avoid conflicts */
  testKeyPrefix: string;
}

/**
 * Check if integration tests should run.
 * Returns false if required environment variables are not set.
 */
export function shouldRunIntegrationTests(): boolean {
  return !!process.env.AZURE_APPCONFIG_ENDPOINT;
}

/**
 * Get integration test configuration from environment variables.
 * Throws if required variables are not set.
 */
export function getIntegrationConfig(): IntegrationTestConfig {
  const endpoint = process.env.AZURE_APPCONFIG_ENDPOINT;
  const keyVault = process.env.AZURE_KEYVAULT_URL;

  if (!endpoint) {
    throw new Error(
      'Integration tests require AZURE_APPCONFIG_ENDPOINT environment variable. ' +
        'Set it to your App Configuration endpoint (e.g., https://myconfig.azconfig.io)'
    );
  }

  return {
    appConfigEndpoint: endpoint,
    keyVaultUrl: keyVault || '',
    testKeyPrefix: `integration-test-${Date.now()}`,
  };
}

/**
 * Get a credential for Azure SDK clients.
 * Uses DefaultAzureCredential which supports multiple auth methods.
 */
export function getCredential(): TokenCredential {
  return new DefaultAzureCredential();
}
