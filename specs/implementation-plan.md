# Azure Env VS Code Extension - Implementation Plan

## Overview

Build a VS Code extension that connects to Azure App Configuration, resolves values (including Key Vault references), and injects them into terminal environment variables.

**Scope (Core Only):**
- Connect flow: authenticate via VS Code's built-in Microsoft authentication, select store, select keys
- Environment injection via `EnvironmentVariableCollection` API
- Refresh command to re-fetch values
- Key transformation: `MyService/Database/Host` → `MYSERVICE_DATABASE_HOST`

**Out of scope for core:** Tree view, add config/secret commands, disconnect command

---

## Authentication Approach

> **Note:** The `ms-vscode.azure-account` extension was deprecated in January 2025. This implementation uses VS Code's built-in Microsoft authentication provider via the `@microsoft/vscode-azext-azureauth` package, which is Microsoft's recommended migration path.

**Benefits:**
- No extension dependency required - uses VS Code's native auth
- More reliable authentication with better proxy support
- Multi-account and multi-tenant support built-in
- Future-proof following Microsoft's guidance

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
│   │   ├── authService.ts        # VS Code Microsoft auth integration
│   │   ├── appConfigService.ts   # List stores, fetch settings
│   │   └── keyVaultService.ts    # Resolve secret references
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

### Step 3: Auth Service
- `src/services/authService.ts`:
  - Use `@microsoft/vscode-azext-azureauth` for VS Code authentication
  - Use `@microsoft/vscode-azext-utils` for extension utilities
  - `getAzureSubscriptionProvider()` - get subscription provider instance
  - `ensureSignedIn()` - check auth status, handle `NotSignedInError`
  - `getSubscriptions()` - list subscriptions via the subscription provider
  - `getCredential(subscriptionId)` - get `TokenCredential` for Azure SDK calls

**Key API usage:**
```typescript
import { getAzureSubscriptionProvider, isNotSignedInError } from '@microsoft/vscode-azext-azureauth';

const provider = await getAzureSubscriptionProvider();
if (!provider.isSignedIn) {
  const success = await provider.signIn();
  if (!success) throw new Error('Sign in required');
}
const subscriptions = await provider.getSubscriptions(false);
```

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
  1. Ensure signed in via auth service
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
  - Register extension context with `@microsoft/vscode-azext-utils`
  - Register `azureEnv.connect` and `azureEnv.refresh` commands
  - Watch for configuration changes
  - Auto-refresh on activation if already configured (delayed 2s)
  - `refreshAndInject()` - fetch values and populate env collection

### Step 9: Tests
- Unit tests for models (key transformation, reference parsing)
- Unit tests for services (mocked Azure SDKs)
- VS Code mock using `@vscode/test-electron` or vitest with manual mocks

---

## Key Dependencies

```json
{
  "dependencies": {
    "@microsoft/vscode-azext-azureauth": "^5.1.1",
    "@microsoft/vscode-azext-utils": "^4.0.3",
    "@azure/identity": "^4.13.0",
    "@azure/app-configuration": "^1.10.0",
    "@azure/arm-appconfiguration": "^5.0.0",
    "@azure/keyvault-secrets": "^4.10.0"
  },
  "devDependencies": {
    "@types/vscode": "^1.108.0",
    "typescript": "^5.9.0",
    "esbuild": "^0.27.0",
    "vitest": "^4.0.0"
  }
}
```

**No `extensionDependencies` required** - authentication is handled via VS Code's built-in Microsoft authentication provider.

> **Note:** Do NOT use `@azure/identity-vscode` - it depends on the deprecated Azure Account extension. The `@microsoft/vscode-azext-azureauth` package handles VS Code authentication natively.

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

**Authentication Flow:**
1. Extension calls `getAzureSubscriptionProvider()`
2. Check `provider.isSignedIn` - if false, call `provider.signIn()`
3. VS Code shows native Microsoft sign-in prompt
4. Once signed in, `provider.getSubscriptions()` returns available subscriptions
5. Use subscription's credential for Azure SDK client instantiation

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
   - VS Code prompts for Microsoft sign-in (if not already signed in)
   - Select subscription, store, and keys
   - Open terminal, verify env vars with `echo $MYSERVICE_DATABASE_HOST`
   - Run "Azure Env: Refresh Environment"
   - Verify updated values appear in new terminals
3. **Error cases:**
   - Test with user not signed in (should prompt sign-in)
   - Test with invalid/expired credentials
   - Test with Key Vault access denied (partial success)
   - Test with no network connectivity
