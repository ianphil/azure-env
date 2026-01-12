/**
 * Transform an App Configuration key to an environment variable name.
 * Converts slashes to underscores and uppercases the entire key.
 *
 * @example
 * transformKeyToEnvVar('MyService/Database/Host') // 'MYSERVICE_DATABASE_HOST'
 */
export function transformKeyToEnvVar(key: string): string {
  return key.replace(/\//g, '_').toUpperCase();
}

/**
 * Check if a content type indicates a Key Vault reference.
 * Key Vault references have content type: application/vnd.microsoft.appconfig.keyvaultref+json
 */
export function isKeyVaultReference(contentType: string | undefined): boolean {
  return contentType?.includes('keyvaultref') ?? false;
}

/**
 * Parse a Key Vault reference JSON value and extract the secret URI.
 *
 * @throws Error if JSON is invalid or missing uri field
 */
export function parseKeyVaultReference(value: string): string {
  const parsed = JSON.parse(value);
  if (!parsed.uri) {
    throw new Error('Missing uri in Key Vault reference');
  }
  return parsed.uri;
}

/**
 * Information extracted from a Key Vault secret URI.
 */
export interface KeyVaultSecretInfo {
  vaultUrl: string;
  secretName: string;
  version?: string;
}

/**
 * Parse a Key Vault secret URI into its components.
 *
 * @example
 * parseKeyVaultSecretUri('https://myvault.vault.azure.net/secrets/MySecret')
 * // { vaultUrl: 'https://myvault.vault.azure.net', secretName: 'MySecret' }
 *
 * @throws Error if URI is invalid or not a secret URI
 */
export function parseKeyVaultSecretUri(uri: string): KeyVaultSecretInfo {
  const url = new URL(uri);
  const parts = url.pathname.split('/');
  // pathname: /secrets/SecretName or /secrets/SecretName/version
  if (parts[1] !== 'secrets' || !parts[2]) {
    throw new Error('Invalid Key Vault secret URI');
  }
  return {
    vaultUrl: `${url.protocol}//${url.host}`,
    secretName: parts[2],
    version: parts[3],
  };
}
