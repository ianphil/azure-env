# Azure Env VS Code Extension - Implementation Plan

## Overview

Build a VS Code extension that connects to Azure App Configuration, resolves values (including Key Vault references), and injects them into terminal environment variables.

**Scope (Core Only):**
- Connect flow: authenticate via Azure Account, select store, select keys
- Environment injection via `EnvironmentVariableCollection` API
- Refresh command to re-fetch values
- Key transformation: `MyService/Database/Host` → `MYSERVICE_DATABASE_HOST`

**Out of scope for core:** Tree view, add config/secret commands, disconnect command

---

## Project Structure

```
azure-env/
├── package.json              # VS Code extension manifest
├── tsconfig.json
├── esbuild.mjs               # Build script
├── vitest.config.ts
├── src/
│   ├── extension.ts          # Entry point, command registration, env collection
│   ├── services/
│   │   ├── credentialService.ts   # Azure Account integration
│   │   ├── appConfigService.ts    # List stores, fetch settings
│   │   └── keyVaultService.ts     # Resolve secret references
│   ├── commands/
│   │   ├── connect.ts        # Subscription → Store → Keys flow
│   │   └── refresh.ts        # Fetch and resolve all values
│   └── models/
│       ├── settings.ts       # Workspace settings interface
│       └── configValue.ts    # Key Vault reference detection, key transform
└── test/
    ├── __mocks__/vscode.ts
    └── ...
```

---

## Implementation Steps

### Step 1: Project Initialization
- Create `package.json` with extension manifest, commands, configuration schema
- Create `tsconfig.json` for TypeScript
- Create `esbuild.mjs` for bundling
- Create `vitest.config.ts` with VS Code mock setup
- Add `.vscodeignore`, `.gitignore`

### Step 2: Models Layer
- `src/models/settings.ts` - `AzureEnvSettings` interface, `getSettings()`, `saveSettings()`
- `src/models/configValue.ts`:
  - `transformKeyToEnvVar()` - replace `/` with `_`, uppercase
  - `isKeyVaultReference()` - check content type
  - `parseKeyVaultReference()` - extract URI from JSON
  - `parseKeyVaultSecretUri()` - extract vault URL and secret name

### Step 3: Credential Service
- `src/services/credentialService.ts`:
  - Use `@azure/identity-vscode` plugin for VS Code credential
  - `ChainedTokenCredential` with VS Code → Azure CLI fallback
  - `ensureSignedIn()` - check Azure Account extension, prompt sign-in
  - `getSubscriptions()` - list subscriptions from Azure Account

### Step 4: App Configuration Service
- `src/services/appConfigService.ts`:
  - `listStores(subscriptionId)` - use ARM client to list stores
  - `listSettings(endpoint, keyFilter, label)` - list all matching settings
  - `getSettings(endpoint, keys, label)` - fetch specific keys

### Step 5: Key Vault Service
- `src/services/keyVaultService.ts`:
  - Client cache by vault URL
  - `resolveSecret(uri)` - fetch single secret
  - `resolveSecrets(uris)` - parallel resolution with `Promise.allSettled`

### Step 6: Connect Command
- `src/commands/connect.ts`:
  1. Ensure signed in
  2. Show subscription quick pick
  3. List and show store quick pick
  4. Prompt for label filter (optional)
  5. List all keys, show multi-select quick pick
  6. Save to workspace settings

### Step 7: Refresh Command
- `src/commands/refresh.ts`:
  1. Read settings, validate configuration
  2. Fetch selected keys from App Configuration
  3. Identify Key Vault references by content type
  4. Resolve secrets in parallel
  5. Return resolved values with transformed env var names

### Step 8: Extension Entry Point
- `src/extension.ts`:
  - Initialize `EnvironmentVariableCollection`
  - Register `azureEnv.connect` and `azureEnv.refresh` commands
  - Watch for configuration changes
  - Auto-refresh on activation if already configured (delayed 2s)
  - `refreshAndInject()` - fetch values and populate env collection

### Step 9: Tests
- Unit tests for models (key transformation, reference parsing)
- Unit tests for services (mocked Azure SDKs)
- VS Code mock using `jest-mock-vscode`

---

## Key Dependencies

```json
{
  "dependencies": {
    "@azure/identity": "^4.0.0",
    "@azure/identity-vscode": "^1.0.0",
    "@azure/app-configuration": "^1.5.0",
    "@azure/arm-appconfiguration": "^4.0.0",
    "@azure/keyvault-secrets": "^4.8.0"
  },
  "extensionDependencies": ["ms-vscode.azure-account"]
}
```

---

## Workspace Settings Schema

```json
{
  "azureEnv.appConfiguration.endpoint": "https://myconfig.azconfig.io",
  "azureEnv.appConfiguration.keyFilter": "*",
  "azureEnv.appConfiguration.label": "dev",
  "azureEnv.appConfiguration.selectedKeys": ["MyService/Database/Host", "MyService/Database/Password"]
}
```

---

## Key Technical Details

**Key Vault Reference Detection:**
- Content type: `application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8`
- Value format: `{"uri": "https://vault.vault.azure.net/secrets/SecretName"}`

**Environment Variable Transform:**
```typescript
function transformKeyToEnvVar(key: string): string {
  return key.replace(/\//g, '_').toUpperCase();
}
```

**Activation:** Use `onStartupFinished` to avoid blocking VS Code startup.

---

## Verification

1. **Unit tests:** `npm test` - all model and service tests pass
2. **Manual testing:**
   - Install extension in VS Code (F5 debug)
   - Run "Azure Env: Connect to App Configuration"
   - Select subscription, store, and keys
   - Open terminal, verify env vars with `echo $MYSERVICE_DATABASE_HOST`
   - Run "Azure Env: Refresh Environment"
   - Verify updated values appear in new terminals
3. **Error cases:**
   - Test with invalid/expired credentials
   - Test with Key Vault access denied (partial success)
   - Test with no network connectivity
