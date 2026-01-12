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

## TDD Approach

This implementation follows **Test-Driven Development (TDD)** with the red/green/refactor cycle:

1. **RED** - Write a failing test that defines the expected behavior
2. **GREEN** - Write the minimum code to make the test pass
3. **REFACTOR** - Clean up the code while keeping tests green

Benefits:
- Forces clear thinking about interfaces before implementation
- Ensures comprehensive test coverage
- Produces modular, testable code
- Documents expected behavior through tests

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
    ├── setup.ts              # Test setup and VS Code mocks
    ├── models/
    │   ├── settings.test.ts
    │   └── configValue.test.ts
    ├── services/
    │   ├── authService.test.ts
    │   ├── appConfigService.test.ts
    │   └── keyVaultService.test.ts
    └── commands/
        ├── connect.test.ts
        └── refresh.test.ts
```

---

## Implementation Steps (TDD)

### Step 1: Project Setup & Test Infrastructure

**Goal:** Establish project with working test runner and VS Code mocks.

1. Create `package.json` with extension manifest, commands, configuration schema
2. Create `tsconfig.json` for TypeScript
3. Create `esbuild.mjs` for bundling
4. Create `vitest.config.ts` with VS Code mock setup
5. Create `test/setup.ts` with VS Code API mocks
6. Add `.vscodeignore`, `.gitignore`

**Verify:** `npm test` runs (even with no tests yet)

---

### Step 2: Models - Config Value Utilities (TDD)

#### 2.1 Key Transformation

**RED** - Write failing tests first:

```typescript
// test/models/configValue.test.ts
import { describe, it, expect } from 'vitest';
import { transformKeyToEnvVar } from '../../src/models/configValue';

describe('transformKeyToEnvVar', () => {
  it('converts slashes to underscores', () => {
    expect(transformKeyToEnvVar('MyService/Database/Host')).toBe('MYSERVICE_DATABASE_HOST');
  });

  it('uppercases the entire key', () => {
    expect(transformKeyToEnvVar('lowercase')).toBe('LOWERCASE');
  });

  it('handles keys without slashes', () => {
    expect(transformKeyToEnvVar('SimpleKey')).toBe('SIMPLEKEY');
  });

  it('handles empty string', () => {
    expect(transformKeyToEnvVar('')).toBe('');
  });

  it('handles keys with multiple consecutive slashes', () => {
    expect(transformKeyToEnvVar('a//b')).toBe('A__B');
  });
});
```

**GREEN** - Implement minimum code:

```typescript
// src/models/configValue.ts
export function transformKeyToEnvVar(key: string): string {
  return key.replace(/\//g, '_').toUpperCase();
}
```

#### 2.2 Key Vault Reference Detection

**RED** - Write failing tests:

```typescript
describe('isKeyVaultReference', () => {
  it('returns true for Key Vault reference content type', () => {
    const contentType = 'application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8';
    expect(isKeyVaultReference(contentType)).toBe(true);
  });

  it('returns false for plain text content type', () => {
    expect(isKeyVaultReference('text/plain')).toBe(false);
  });

  it('returns false for undefined content type', () => {
    expect(isKeyVaultReference(undefined)).toBe(false);
  });

  it('returns true for content type without charset', () => {
    const contentType = 'application/vnd.microsoft.appconfig.keyvaultref+json';
    expect(isKeyVaultReference(contentType)).toBe(true);
  });
});
```

**GREEN** - Implement:

```typescript
export function isKeyVaultReference(contentType: string | undefined): boolean {
  return contentType?.includes('keyvaultref') ?? false;
}
```

#### 2.3 Parse Key Vault Reference

**RED** - Write failing tests:

```typescript
describe('parseKeyVaultReference', () => {
  it('extracts URI from valid reference JSON', () => {
    const value = '{"uri":"https://myvault.vault.azure.net/secrets/MySecret"}';
    expect(parseKeyVaultReference(value)).toBe('https://myvault.vault.azure.net/secrets/MySecret');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseKeyVaultReference('not json')).toThrow();
  });

  it('throws on missing uri field', () => {
    expect(() => parseKeyVaultReference('{}')).toThrow('Missing uri');
  });
});
```

**GREEN** - Implement:

```typescript
export function parseKeyVaultReference(value: string): string {
  const parsed = JSON.parse(value);
  if (!parsed.uri) {
    throw new Error('Missing uri in Key Vault reference');
  }
  return parsed.uri;
}
```

#### 2.4 Parse Key Vault Secret URI

**RED** - Write failing tests:

```typescript
describe('parseKeyVaultSecretUri', () => {
  it('extracts vault URL and secret name', () => {
    const uri = 'https://myvault.vault.azure.net/secrets/MySecret';
    const result = parseKeyVaultSecretUri(uri);
    expect(result.vaultUrl).toBe('https://myvault.vault.azure.net');
    expect(result.secretName).toBe('MySecret');
  });

  it('handles URI with version', () => {
    const uri = 'https://myvault.vault.azure.net/secrets/MySecret/abc123';
    const result = parseKeyVaultSecretUri(uri);
    expect(result.secretName).toBe('MySecret');
    expect(result.version).toBe('abc123');
  });

  it('throws on invalid URI', () => {
    expect(() => parseKeyVaultSecretUri('not-a-url')).toThrow();
  });
});
```

**GREEN** - Implement:

```typescript
export interface KeyVaultSecretInfo {
  vaultUrl: string;
  secretName: string;
  version?: string;
}

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
```

---

### Step 3: Models - Settings (TDD)

**RED** - Write failing tests:

```typescript
// test/models/settings.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getSettings, saveSettings, type AzureEnvSettings } from '../../src/models/settings';

// Mock VS Code workspace
vi.mock('vscode', () => ({
  workspace: {
    getConfiguration: vi.fn(),
  },
  ConfigurationTarget: { Workspace: 1 },
}));

describe('getSettings', () => {
  it('returns settings from workspace configuration', () => {
    const mockConfig = {
      get: vi.fn((key: string) => {
        const values: Record<string, unknown> = {
          endpoint: 'https://test.azconfig.io',
          selectedKeys: ['key1', 'key2'],
          label: 'dev',
        };
        return values[key];
      }),
    };
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

    const settings = getSettings();
    expect(settings.endpoint).toBe('https://test.azconfig.io');
    expect(settings.selectedKeys).toEqual(['key1', 'key2']);
  });

  it('returns empty values when not configured', () => {
    const mockConfig = { get: vi.fn(() => undefined) };
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

    const settings = getSettings();
    expect(settings.endpoint).toBe('');
    expect(settings.selectedKeys).toEqual([]);
  });
});

describe('saveSettings', () => {
  it('saves settings to workspace configuration', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockConfig = { update: mockUpdate };
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

    await saveSettings({ endpoint: 'https://new.azconfig.io', selectedKeys: ['key1'] });

    expect(mockUpdate).toHaveBeenCalledWith('endpoint', 'https://new.azconfig.io', 1);
    expect(mockUpdate).toHaveBeenCalledWith('selectedKeys', ['key1'], 1);
  });
});
```

**GREEN** - Implement `src/models/settings.ts`

---

### Step 4: Key Vault Service (TDD)

**RED** - Write failing tests:

```typescript
// test/services/keyVaultService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { KeyVaultService } from '../../src/services/keyVaultService';

// Mock @azure/keyvault-secrets
vi.mock('@azure/keyvault-secrets', () => ({
  SecretClient: vi.fn().mockImplementation(() => ({
    getSecret: vi.fn(),
  })),
}));

describe('KeyVaultService', () => {
  let service: KeyVaultService;
  let mockCredential: any;

  beforeEach(() => {
    mockCredential = {};
    service = new KeyVaultService(mockCredential);
  });

  describe('resolveSecret', () => {
    it('fetches secret from Key Vault', async () => {
      const mockGetSecret = vi.fn().mockResolvedValue({ value: 'secret-value' });
      vi.mocked(SecretClient).mockImplementation(() => ({
        getSecret: mockGetSecret,
      }) as any);

      const result = await service.resolveSecret('https://myvault.vault.azure.net/secrets/MySecret');

      expect(result).toBe('secret-value');
      expect(mockGetSecret).toHaveBeenCalledWith('MySecret');
    });

    it('caches clients by vault URL', async () => {
      const mockGetSecret = vi.fn().mockResolvedValue({ value: 'value' });
      vi.mocked(SecretClient).mockImplementation(() => ({
        getSecret: mockGetSecret,
      }) as any);

      await service.resolveSecret('https://vault1.vault.azure.net/secrets/Secret1');
      await service.resolveSecret('https://vault1.vault.azure.net/secrets/Secret2');

      // SecretClient should only be instantiated once for the same vault
      expect(SecretClient).toHaveBeenCalledTimes(1);
    });
  });

  describe('resolveSecrets', () => {
    it('resolves multiple secrets in parallel', async () => {
      const mockGetSecret = vi.fn().mockResolvedValue({ value: 'value' });
      vi.mocked(SecretClient).mockImplementation(() => ({
        getSecret: mockGetSecret,
      }) as any);

      const uris = [
        'https://vault.vault.azure.net/secrets/Secret1',
        'https://vault.vault.azure.net/secrets/Secret2',
      ];

      const results = await service.resolveSecrets(uris);

      expect(results).toHaveLength(2);
      expect(results[0].status).toBe('fulfilled');
    });

    it('handles partial failures gracefully', async () => {
      const mockGetSecret = vi.fn()
        .mockResolvedValueOnce({ value: 'value1' })
        .mockRejectedValueOnce(new Error('Access denied'));

      vi.mocked(SecretClient).mockImplementation(() => ({
        getSecret: mockGetSecret,
      }) as any);

      const uris = [
        'https://vault.vault.azure.net/secrets/Secret1',
        'https://vault.vault.azure.net/secrets/Secret2',
      ];

      const results = await service.resolveSecrets(uris);

      expect(results[0].status).toBe('fulfilled');
      expect(results[1].status).toBe('rejected');
    });
  });
});
```

**GREEN** - Implement `src/services/keyVaultService.ts`

---

### Step 5: App Configuration Service (TDD)

**RED** - Write failing tests:

```typescript
// test/services/appConfigService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AppConfigService } from '../../src/services/appConfigService';

vi.mock('@azure/app-configuration');
vi.mock('@azure/arm-appconfiguration');

describe('AppConfigService', () => {
  describe('listSettings', () => {
    it('fetches settings with key filter and label', async () => {
      const mockSettings = [
        { key: 'App/Setting1', value: 'value1', contentType: 'text/plain' },
        { key: 'App/Setting2', value: '{"uri":"..."}', contentType: 'application/vnd.microsoft.appconfig.keyvaultref+json' },
      ];

      const mockListConfigurationSettings = vi.fn().mockImplementation(async function* () {
        for (const setting of mockSettings) {
          yield setting;
        }
      });

      vi.mocked(AppConfigurationClient).mockImplementation(() => ({
        listConfigurationSettings: mockListConfigurationSettings,
      }) as any);

      const service = new AppConfigService('https://test.azconfig.io', mockCredential);
      const results = await service.listSettings('App/*', 'dev');

      expect(results).toHaveLength(2);
      expect(results[0].key).toBe('App/Setting1');
    });
  });

  describe('getSetting', () => {
    it('fetches a single setting by key', async () => {
      const mockGetConfigurationSetting = vi.fn().mockResolvedValue({
        key: 'App/Setting1',
        value: 'value1',
      });

      vi.mocked(AppConfigurationClient).mockImplementation(() => ({
        getConfigurationSetting: mockGetConfigurationSetting,
      }) as any);

      const service = new AppConfigService('https://test.azconfig.io', mockCredential);
      const result = await service.getSetting('App/Setting1', 'dev');

      expect(result.value).toBe('value1');
      expect(mockGetConfigurationSetting).toHaveBeenCalledWith({ key: 'App/Setting1', label: 'dev' });
    });
  });
});
```

**GREEN** - Implement `src/services/appConfigService.ts`

---

### Step 6: Auth Service (TDD)

**RED** - Write failing tests:

```typescript
// test/services/authService.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AuthService } from '../../src/services/authService';

vi.mock('@microsoft/vscode-azext-azureauth');

describe('AuthService', () => {
  describe('ensureSignedIn', () => {
    it('returns true if already signed in', async () => {
      const mockProvider = {
        isSignedIn: vi.fn().mockResolvedValue(true),
        signIn: vi.fn(),
      };
      vi.mocked(VSCodeAzureSubscriptionProvider).mockImplementation(() => mockProvider as any);

      const service = new AuthService();
      const result = await service.ensureSignedIn();

      expect(result).toBe(true);
      expect(mockProvider.signIn).not.toHaveBeenCalled();
    });

    it('prompts sign-in if not signed in', async () => {
      const mockProvider = {
        isSignedIn: vi.fn().mockResolvedValue(false),
        signIn: vi.fn().mockResolvedValue(true),
      };
      vi.mocked(VSCodeAzureSubscriptionProvider).mockImplementation(() => mockProvider as any);

      const service = new AuthService();
      const result = await service.ensureSignedIn();

      expect(result).toBe(true);
      expect(mockProvider.signIn).toHaveBeenCalled();
    });

    it('returns false if sign-in is cancelled', async () => {
      const mockProvider = {
        isSignedIn: vi.fn().mockResolvedValue(false),
        signIn: vi.fn().mockResolvedValue(false),
      };
      vi.mocked(VSCodeAzureSubscriptionProvider).mockImplementation(() => mockProvider as any);

      const service = new AuthService();
      const result = await service.ensureSignedIn();

      expect(result).toBe(false);
    });
  });

  describe('getSubscriptions', () => {
    it('returns list of subscriptions', async () => {
      const mockSubscriptions = [
        { name: 'Sub1', subscriptionId: 'sub-1', credential: {} },
        { name: 'Sub2', subscriptionId: 'sub-2', credential: {} },
      ];
      const mockProvider = {
        getSubscriptions: vi.fn().mockResolvedValue(mockSubscriptions),
      };
      vi.mocked(VSCodeAzureSubscriptionProvider).mockImplementation(() => mockProvider as any);

      const service = new AuthService();
      const result = await service.getSubscriptions();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Sub1');
    });
  });
});
```

**GREEN** - Implement `src/services/authService.ts`

---

### Step 7: Refresh Command (TDD)

**RED** - Write failing tests:

```typescript
// test/commands/refresh.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { refreshEnvironment } from '../../src/commands/refresh';

describe('refreshEnvironment', () => {
  let mockEnvCollection: any;
  let mockAppConfigService: any;
  let mockKeyVaultService: any;

  beforeEach(() => {
    mockEnvCollection = {
      clear: vi.fn(),
      replace: vi.fn(),
    };
  });

  it('clears and repopulates environment collection', async () => {
    mockAppConfigService = {
      getSetting: vi.fn().mockResolvedValue({ key: 'App/Key', value: 'value', contentType: 'text/plain' }),
    };

    await refreshEnvironment({
      endpoint: 'https://test.azconfig.io',
      selectedKeys: ['App/Key'],
      label: 'dev',
      envCollection: mockEnvCollection,
      appConfigService: mockAppConfigService,
      keyVaultService: mockKeyVaultService,
    });

    expect(mockEnvCollection.clear).toHaveBeenCalled();
    expect(mockEnvCollection.replace).toHaveBeenCalledWith('APP_KEY', 'value');
  });

  it('resolves Key Vault references', async () => {
    mockAppConfigService = {
      getSetting: vi.fn().mockResolvedValue({
        key: 'App/Secret',
        value: '{"uri":"https://vault.vault.azure.net/secrets/MySecret"}',
        contentType: 'application/vnd.microsoft.appconfig.keyvaultref+json',
      }),
    };
    mockKeyVaultService = {
      resolveSecret: vi.fn().mockResolvedValue('resolved-secret'),
    };

    await refreshEnvironment({
      endpoint: 'https://test.azconfig.io',
      selectedKeys: ['App/Secret'],
      label: 'dev',
      envCollection: mockEnvCollection,
      appConfigService: mockAppConfigService,
      keyVaultService: mockKeyVaultService,
    });

    expect(mockKeyVaultService.resolveSecret).toHaveBeenCalled();
    expect(mockEnvCollection.replace).toHaveBeenCalledWith('APP_SECRET', 'resolved-secret');
  });

  it('continues on partial failures', async () => {
    mockAppConfigService = {
      getSetting: vi.fn()
        .mockResolvedValueOnce({ key: 'App/Key1', value: 'value1', contentType: 'text/plain' })
        .mockRejectedValueOnce(new Error('Not found'))
        .mockResolvedValueOnce({ key: 'App/Key3', value: 'value3', contentType: 'text/plain' }),
    };

    const result = await refreshEnvironment({
      endpoint: 'https://test.azconfig.io',
      selectedKeys: ['App/Key1', 'App/Key2', 'App/Key3'],
      label: 'dev',
      envCollection: mockEnvCollection,
      appConfigService: mockAppConfigService,
      keyVaultService: mockKeyVaultService,
    });

    expect(result.succeeded).toBe(2);
    expect(result.failed).toBe(1);
  });
});
```

**GREEN** - Implement `src/commands/refresh.ts`

---

### Step 8: Connect Command (TDD)

**RED** - Write failing tests for the orchestration logic (mocking VS Code UI):

```typescript
// test/commands/connect.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runConnectFlow } from '../../src/commands/connect';

describe('runConnectFlow', () => {
  it('saves settings after successful flow', async () => {
    const mockAuthService = {
      ensureSignedIn: vi.fn().mockResolvedValue(true),
      getSubscriptions: vi.fn().mockResolvedValue([{ name: 'Sub1', subscriptionId: 'sub-1', credential: {} }]),
    };
    const mockShowQuickPick = vi.fn()
      .mockResolvedValueOnce({ subscription: { subscriptionId: 'sub-1', credential: {} } }) // subscription
      .mockResolvedValueOnce({ endpoint: 'https://test.azconfig.io' }) // store
      .mockResolvedValueOnce([{ label: 'App/Key1' }, { label: 'App/Key2' }]); // keys

    const mockSaveSettings = vi.fn();

    await runConnectFlow({
      authService: mockAuthService,
      showQuickPick: mockShowQuickPick,
      saveSettings: mockSaveSettings,
      listStores: vi.fn().mockResolvedValue([{ name: 'store', endpoint: 'https://test.azconfig.io' }]),
      listKeys: vi.fn().mockResolvedValue(['App/Key1', 'App/Key2']),
    });

    expect(mockSaveSettings).toHaveBeenCalledWith({
      endpoint: 'https://test.azconfig.io',
      selectedKeys: ['App/Key1', 'App/Key2'],
    });
  });

  it('aborts if user cancels subscription picker', async () => {
    const mockAuthService = {
      ensureSignedIn: vi.fn().mockResolvedValue(true),
      getSubscriptions: vi.fn().mockResolvedValue([{ name: 'Sub1' }]),
    };
    const mockShowQuickPick = vi.fn().mockResolvedValue(undefined);
    const mockSaveSettings = vi.fn();

    await runConnectFlow({
      authService: mockAuthService,
      showQuickPick: mockShowQuickPick,
      saveSettings: mockSaveSettings,
      listStores: vi.fn(),
      listKeys: vi.fn(),
    });

    expect(mockSaveSettings).not.toHaveBeenCalled();
  });

  it('aborts if sign-in fails', async () => {
    const mockAuthService = {
      ensureSignedIn: vi.fn().mockResolvedValue(false),
    };
    const mockSaveSettings = vi.fn();

    await runConnectFlow({
      authService: mockAuthService,
      showQuickPick: vi.fn(),
      saveSettings: mockSaveSettings,
      listStores: vi.fn(),
      listKeys: vi.fn(),
    });

    expect(mockSaveSettings).not.toHaveBeenCalled();
  });
});
```

**GREEN** - Implement `src/commands/connect.ts`

---

### Step 9: Extension Entry Point (Integration)

Implement `src/extension.ts` to wire everything together:
- Initialize services
- Register commands that use the tested modules
- Set up environment variable collection

This is primarily integration code - the business logic is already tested in the individual modules.

---

## Key Dependencies

```json
{
  "dependencies": {
    "@microsoft/vscode-azext-azureauth": "^5.1.1",
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
1. `AuthService.ensureSignedIn()` checks if user is signed in
2. If not, `VSCodeAzureSubscriptionProvider.signIn()` triggers VS Code's native Microsoft sign-in
3. `getSubscriptions()` returns available subscriptions with credentials
4. Subscription's `credential` is used for Azure SDK client instantiation

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

## TDD Workflow Summary

| Step | RED (Test First) | GREEN (Implement) | Files |
|------|------------------|-------------------|-------|
| 2.1 | `transformKeyToEnvVar` tests | Key transformation function | `configValue.ts` |
| 2.2 | `isKeyVaultReference` tests | Content type detection | `configValue.ts` |
| 2.3 | `parseKeyVaultReference` tests | JSON parsing | `configValue.ts` |
| 2.4 | `parseKeyVaultSecretUri` tests | URI parsing | `configValue.ts` |
| 3 | Settings get/save tests | Workspace config wrapper | `settings.ts` |
| 4 | KeyVaultService tests | Secret resolution + caching | `keyVaultService.ts` |
| 5 | AppConfigService tests | Config fetching | `appConfigService.ts` |
| 6 | AuthService tests | Sign-in + subscriptions | `authService.ts` |
| 7 | Refresh command tests | Env injection logic | `refresh.ts` |
| 8 | Connect command tests | Flow orchestration | `connect.ts` |
| 9 | - | Wire up extension | `extension.ts` |

---

## Verification

1. **Unit tests:** `npm test` - all tests pass (run after each RED→GREEN cycle)
2. **Coverage:** Aim for >80% coverage on business logic modules
3. **Manual testing:**
   - Install extension in VS Code (F5 debug)
   - Run "Azure Env: Connect to App Configuration"
   - VS Code prompts for Microsoft sign-in (if not already signed in)
   - Select subscription, store, and keys
   - Open terminal, verify env vars with `echo $MYSERVICE_DATABASE_HOST`
   - Run "Azure Env: Refresh Environment"
   - Verify updated values appear in new terminals
4. **Error cases:**
   - Test with user not signed in (should prompt sign-in)
   - Test with invalid/expired credentials
   - Test with Key Vault access denied (partial success)
   - Test with no network connectivity
