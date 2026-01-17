# Add Config & Add Secret Commands - TDD Implementation Plan

## Overview

Implement "Add Configuration Value" and "Add Secret" commands using TDD. Add Config is implemented first to establish patterns that Add Secret reuses.

## User Flows

### Add Config
1. Prompt for key name (with prefix suggestions from existing keys)
2. Prompt for value
3. Confirm label (default to configured label)
4. Create setting in App Configuration
5. Refresh environment

### Add Secret
1. Select Key Vault (skip if default configured)
2. Prompt for secret name
3. Prompt for secret value
4. Create secret in Key Vault
5. Prompt: "Create App Configuration reference?"
6. If yes: prompt for App Config key name (defaults to secret name)
7. If yes: create Key Vault reference in App Configuration
8. Refresh environment

## Files to Modify/Create

| File | Action | Phase |
|------|--------|-------|
| `src/services/appConfigService.ts` | Add `createSetting()` | Add Config |
| `test/services/appConfigService.test.ts` | Add tests | Add Config |
| `src/commands/addConfig.ts` | **Create** | Add Config |
| `test/commands/addConfig.test.ts` | **Create** | Add Config |
| `src/services/keyVaultService.ts` | Add `createSecret()`, `listVaults()` | Add Secret |
| `test/services/keyVaultService.test.ts` | Add tests | Add Secret |
| `src/services/appConfigService.ts` | Add `createKeyVaultReference()` | Add Secret |
| `src/commands/addSecret.ts` | **Create** | Add Secret |
| `test/commands/addSecret.test.ts` | **Create** | Add Secret |
| `src/models/settings.ts` | Add `defaultVault` | Add Secret |
| `src/extension.ts` | Register both commands | Both |
| `package.json` | Add commands, setting, `@azure/arm-keyvault` | Both |

---

## Part 1: Add Config Command

### Slice 1.1: AppConfigService.createSetting()

**Test file:** `test/services/appConfigService.test.ts`

```typescript
describe('createSetting', () => {
  it('creates setting with key, value, and label', async () => {
    mockSetConfigurationSetting.mockResolvedValue({ key: 'App/Host', value: 'localhost' });

    await service.createSetting('App/Host', 'localhost', 'dev');

    expect(mockSetConfigurationSetting).toHaveBeenCalledWith({
      key: 'App/Host',
      value: 'localhost',
      label: 'dev',
    });
  });

  it('creates setting without label when label is empty', async () => {
    mockSetConfigurationSetting.mockResolvedValue({});

    await service.createSetting('App/Host', 'localhost', '');

    expect(mockSetConfigurationSetting).toHaveBeenCalledWith({
      key: 'App/Host',
      value: 'localhost',
      label: undefined,
    });
  });

  it('throws AppConfigError on failure', async () => {
    mockSetConfigurationSetting.mockRejectedValue(new Error('Forbidden'));

    await expect(service.createSetting('App/Key', 'value', 'dev'))
      .rejects.toThrow(AppConfigError);
  });
});
```

**Implementation:**

```typescript
async createSetting(key: string, value: string, label?: string): Promise<void> {
  try {
    await this.client.setConfigurationSetting({
      key,
      value,
      label: label || undefined,
    });
  } catch (error) {
    if (isRateLimitError(error)) {
      throw new RateLimitError('AppConfig', extractRetryAfter(error), error as Error);
    }
    throw new AppConfigError(`Failed to create setting: ${key}`, key, label, error as Error);
  }
}
```

---

### Slice 1.2: runAddConfigFlow() - Types

**New file:** `src/commands/addConfig.ts`

```typescript
import type { QuickPickItem } from 'vscode';

export interface AddConfigFlowDeps {
  showInputBox: (options: {
    prompt: string;
    placeHolder?: string;
    value?: string;
  }) => Promise<string | undefined>;
  showQuickPickSingle: <T extends QuickPickItem>(
    items: T[],
    options?: { placeHolder?: string }
  ) => Promise<T | undefined>;
  getExistingPrefixes: () => Promise<string[]>;
  createSetting: (key: string, value: string, label?: string) => Promise<void>;
  refresh: () => Promise<void>;
  getLabel: () => string;
}

export type AddConfigResult =
  | { success: true; key: string }
  | { success: false; reason: 'cancelled' };
```

---

### Slice 1.3: runAddConfigFlow() - Happy Path

**Test file:** `test/commands/addConfig.test.ts`

```typescript
describe('runAddConfigFlow', () => {
  let mockShowInputBox: ReturnType<typeof vi.fn>;
  let mockShowQuickPickSingle: ReturnType<typeof vi.fn>;
  let mockGetExistingPrefixes: ReturnType<typeof vi.fn>;
  let mockCreateSetting: ReturnType<typeof vi.fn>;
  let mockRefresh: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockShowInputBox = vi.fn();
    mockShowQuickPickSingle = vi.fn();
    mockGetExistingPrefixes = vi.fn();
    mockCreateSetting = vi.fn();
    mockRefresh = vi.fn();
  });

  function createDeps(overrides: Partial<AddConfigFlowDeps> = {}): AddConfigFlowDeps {
    return {
      showInputBox: mockShowInputBox,
      showQuickPickSingle: mockShowQuickPickSingle,
      getExistingPrefixes: mockGetExistingPrefixes,
      createSetting: mockCreateSetting,
      refresh: mockRefresh,
      getLabel: () => 'dev',
      ...overrides,
    };
  }

  it('creates setting and refreshes environment', async () => {
    mockGetExistingPrefixes.mockResolvedValue(['App/', 'Service/']);
    mockShowInputBox
      .mockResolvedValueOnce('App/NewKey')  // key name
      .mockResolvedValueOnce('my-value');    // value
    mockShowQuickPickSingle.mockResolvedValue({ label: 'dev', value: 'dev' });
    mockCreateSetting.mockResolvedValue(undefined);

    const result = await runAddConfigFlow(createDeps());

    expect(result).toEqual({ success: true, key: 'App/NewKey' });
    expect(mockCreateSetting).toHaveBeenCalledWith('App/NewKey', 'my-value', 'dev');
    expect(mockRefresh).toHaveBeenCalled();
  });
});
```

---

### Slice 1.4: runAddConfigFlow() - Cancellation

```typescript
describe('cancellation', () => {
  it('returns cancelled when user cancels key input', async () => {
    mockGetExistingPrefixes.mockResolvedValue([]);
    mockShowInputBox.mockResolvedValueOnce(undefined);

    const result = await runAddConfigFlow(createDeps());

    expect(result).toEqual({ success: false, reason: 'cancelled' });
    expect(mockCreateSetting).not.toHaveBeenCalled();
  });

  it('returns cancelled when user cancels value input', async () => {
    mockGetExistingPrefixes.mockResolvedValue([]);
    mockShowInputBox
      .mockResolvedValueOnce('App/Key')
      .mockResolvedValueOnce(undefined);

    const result = await runAddConfigFlow(createDeps());

    expect(result).toEqual({ success: false, reason: 'cancelled' });
  });

  it('returns cancelled when user cancels label selection', async () => {
    mockGetExistingPrefixes.mockResolvedValue([]);
    mockShowInputBox
      .mockResolvedValueOnce('App/Key')
      .mockResolvedValueOnce('value');
    mockShowQuickPickSingle.mockResolvedValue(undefined);

    const result = await runAddConfigFlow(createDeps());

    expect(result).toEqual({ success: false, reason: 'cancelled' });
  });
});
```

---

### Slice 1.5: Extension Integration (Add Config)

**package.json addition:**
```json
{
  "contributes": {
    "commands": [
      { "command": "azureEnv.addConfig", "title": "Azure Env: Add Configuration Value" }
    ]
  }
}
```

---

## Part 2: Add Secret Command

### Slice 2.1: KeyVaultService.createSecret()

**Test file:** `test/services/keyVaultService.test.ts`

```typescript
describe('createSecret', () => {
  it('creates secret and returns URI', async () => {
    mockSetSecret.mockResolvedValue({
      properties: { id: 'https://vault.vault.azure.net/secrets/MySecret/v1' },
    });

    const result = await service.createSecret(
      'https://vault.vault.azure.net',
      'MySecret',
      'secret-value'
    );

    expect(mockSetSecret).toHaveBeenCalledWith('MySecret', 'secret-value');
    expect(result).toBe('https://vault.vault.azure.net/secrets/MySecret/v1');
  });

  it('throws KeyVaultError on failure', async () => {
    mockSetSecret.mockRejectedValue(new Error('Access denied'));

    await expect(
      service.createSecret('https://vault.vault.azure.net', 'MySecret', 'value')
    ).rejects.toThrow(KeyVaultError);
  });
});
```

---

### Slice 2.2: listVaults()

Requires `@azure/arm-keyvault` dependency.

**Test file:** `test/services/keyVaultService.test.ts`

```typescript
describe('listVaults', () => {
  it('returns vault list with name and URI', async () => {
    mockVaultsList.mockReturnValue({
      async *[Symbol.asyncIterator]() {
        yield { name: 'vault1', properties: { vaultUri: 'https://vault1.vault.azure.net' } };
        yield { name: 'vault2', properties: { vaultUri: 'https://vault2.vault.azure.net' } };
      },
    });

    const result = await listVaults('sub-123', mockCredential);

    expect(result).toEqual([
      { name: 'vault1', vaultUri: 'https://vault1.vault.azure.net' },
      { name: 'vault2', vaultUri: 'https://vault2.vault.azure.net' },
    ]);
  });

  it('returns empty array when no vaults', async () => {
    mockVaultsList.mockReturnValue({ async *[Symbol.asyncIterator]() {} });

    const result = await listVaults('sub-123', mockCredential);

    expect(result).toEqual([]);
  });
});
```

---

### Slice 2.3: AppConfigService.createKeyVaultReference()

Reuses `setConfigurationSetting` with special content type.

```typescript
describe('createKeyVaultReference', () => {
  it('creates reference with correct content type', async () => {
    mockSetConfigurationSetting.mockResolvedValue({});

    await service.createKeyVaultReference(
      'App/Secret',
      'https://vault.vault.azure.net/secrets/MySecret/v1',
      'dev'
    );

    expect(mockSetConfigurationSetting).toHaveBeenCalledWith({
      key: 'App/Secret',
      value: JSON.stringify({ uri: 'https://vault.vault.azure.net/secrets/MySecret/v1' }),
      label: 'dev',
      contentType: 'application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8',
    });
  });
});
```

---

### Slice 2.4: runAddSecretFlow() - Types

```typescript
export interface AddSecretFlowDeps {
  showQuickPickSingle: <T extends QuickPickItem>(items: T[], options?) => Promise<T | undefined>;
  showInputBox: (options: { prompt; placeHolder?; password?; value? }) => Promise<string | undefined>;
  showYesNo: (message: string) => Promise<boolean>;
  listVaults: () => Promise<VaultInfo[]>;
  createSecret: (vaultUrl: string, name: string, value: string) => Promise<string>;
  createKeyVaultReference: (key: string, secretUri: string, label?: string) => Promise<void>;
  refresh: () => Promise<void>;
  getDefaultVault: () => string | undefined;
  getLabel: () => string;
}

export type AddSecretResult =
  | { success: true; secretUri: string; appConfigKey?: string }
  | { success: false; reason: 'cancelled' | 'no_vaults' };
```

---

### Slice 2.5: runAddSecretFlow() - Core Tests

```typescript
describe('runAddSecretFlow', () => {
  it('creates secret only when user declines App Config reference', async () => {
    mockGetDefaultVault.mockReturnValue(undefined);
    mockListVaults.mockResolvedValue([{ name: 'vault1', vaultUri: 'https://vault1.vault.azure.net' }]);
    mockShowQuickPickSingle.mockResolvedValue({ vaultUri: 'https://vault1.vault.azure.net' });
    mockShowInputBox
      .mockResolvedValueOnce('MySecret')
      .mockResolvedValueOnce('secret-value');
    mockCreateSecret.mockResolvedValue('https://vault1.vault.azure.net/secrets/MySecret/v1');
    mockShowYesNo.mockResolvedValue(false);

    const result = await runAddSecretFlow(createDeps());

    expect(result).toEqual({
      success: true,
      secretUri: 'https://vault1.vault.azure.net/secrets/MySecret/v1',
    });
    expect(mockCreateKeyVaultReference).not.toHaveBeenCalled();
  });

  it('creates secret and App Config reference when user accepts', async () => {
    // ... setup mocks ...
    mockShowYesNo.mockResolvedValue(true);
    mockShowInputBox.mockResolvedValueOnce('MySecret')
      .mockResolvedValueOnce('value')
      .mockResolvedValueOnce('App/MySecret');

    const result = await runAddSecretFlow(createDeps());

    expect(result).toEqual({
      success: true,
      secretUri: 'https://vault1.vault.azure.net/secrets/MySecret/v1',
      appConfigKey: 'App/MySecret',
    });
    expect(mockCreateKeyVaultReference).toHaveBeenCalled();
  });

  it('skips vault selection when default configured', async () => {
    mockGetDefaultVault.mockReturnValue('https://default.vault.azure.net');
    // ...
    expect(mockListVaults).not.toHaveBeenCalled();
  });

  it('returns no_vaults when vault list is empty', async () => {
    mockGetDefaultVault.mockReturnValue(undefined);
    mockListVaults.mockResolvedValue([]);

    const result = await runAddSecretFlow(createDeps());

    expect(result).toEqual({ success: false, reason: 'no_vaults' });
  });
});
```

---

### Slice 2.6: Settings - defaultVault

Add to `AzureEnvSettings` interface:
```typescript
defaultVault?: string;
```

Read from `azureEnv.keyVault.defaultVault`.

---

### Slice 2.7: Extension Integration (Add Secret)

**package.json additions:**
```json
{
  "contributes": {
    "commands": [
      { "command": "azureEnv.addSecret", "title": "Azure Env: Add Secret" }
    ],
    "configuration": {
      "properties": {
        "azureEnv.keyVault.defaultVault": {
          "type": "string",
          "description": "Default Key Vault URL for adding secrets"
        }
      }
    }
  },
  "dependencies": {
    "@azure/arm-keyvault": "^3.0.0"
  }
}
```

---

## Verification

1. **Unit tests:** `npm test`
2. **Manual test - Add Config:**
   - F5 to launch extension
   - Run "Azure Env: Add Configuration Value"
   - Verify setting appears in Azure Portal
   - Verify environment refreshes
3. **Manual test - Add Secret:**
   - Run "Azure Env: Add Secret"
   - Verify secret in Key Vault (Azure Portal)
   - Verify App Config reference (if created)
   - Verify environment refreshes with resolved value

## Shared Patterns

Both commands share:
- Dependency injection via `deps` parameter
- Result union: `{ success: true; ... } | { success: false; reason }`
- `refresh()` call after successful creation
- `getLabel()` for configured label
- Error propagation to extension.ts for user messaging
