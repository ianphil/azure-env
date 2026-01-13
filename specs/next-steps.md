# Next Steps: Core → MVP

This document outlines what needs to be added after the core implementation to reach the full MVP as defined in the PRD.

---

## Summary

| Feature | Core | MVP |
|---------|------|-----|
| Connect to App Configuration | ✅ | ✅ |
| Environment injection | ✅ | ✅ |
| Refresh command | ✅ | ✅ |
| Key Vault reference resolution | ✅ | ✅ |
| Label selection in connect flow | ✅ | ✅ |
| Tree view UI | ✅ | ✅ |
| Add configuration value | ❌ | ✅ |
| Add secret | ❌ | ✅ |
| Disconnect command | ❌ | ✅ |
| Default Key Vault setting | ❌ | ✅ |

---

## ~~1. Tree View Provider~~ ✅ COMPLETED

**Status:** Implemented in feature/tree-view branch

**Implementation:** See `specs/003-tree-view-tdd-plan.md` for details.

- EnvTreeItem model with secret detection
- Key hierarchy parser for `/` delimiter organization
- EnvTreeProvider with TreeDataProvider implementation
- Copy Value, Copy Key, Reveal Value commands
- Package.json views, menus, and commands configured
- Extension wiring for tree view and refresh integration

---

## 2. Add Configuration Value Command

**File:** `src/commands/addConfig.ts`

**Purpose:** Create a new plain configuration value in App Configuration.

**Flow:**
1. Prompt for key name (with prefix autocomplete from existing keys)
2. Prompt for value
3. Confirm label (default to configured label)
4. Write to App Configuration using `client.setConfigurationSetting()`
5. Refresh local environment

**App Config Service addition:**
```typescript
async createSetting(
  endpoint: string,
  key: string,
  value: string,
  label?: string
): Promise<void> {
  const client = new AppConfigurationClient(endpoint, this.credential);
  await client.setConfigurationSetting({ key, value, label });
}
```

---

## 3. Add Secret Command

**File:** `src/commands/addSecret.ts`

**Purpose:** Create a new secret in Key Vault with optional App Configuration reference.

**Flow:**
1. Select Key Vault (use default if configured, otherwise prompt)
2. Prompt for secret name
3. Prompt for secret value
4. Create secret in Key Vault using `client.setSecret()`
5. Prompt: "Create App Configuration reference?" (Yes/No)
6. If yes: prompt for App Config key name (default to secret name)
7. If yes: create Key Vault reference in App Configuration
8. Refresh local environment

**Key Vault Service addition:**
```typescript
async createSecret(
  vaultUrl: string,
  secretName: string,
  value: string
): Promise<string> {
  const client = this.getClient(vaultUrl);
  const result = await client.setSecret(secretName, value);
  return result.properties.id!; // Returns the secret URI
}
```

**App Config Service addition:**
```typescript
async createKeyVaultReference(
  endpoint: string,
  key: string,
  secretUri: string,
  label?: string
): Promise<void> {
  const client = new AppConfigurationClient(endpoint, this.credential);
  await client.setConfigurationSetting({
    key,
    value: JSON.stringify({ uri: secretUri }),
    label,
    contentType: KEY_VAULT_REFERENCE_CONTENT_TYPE,
  });
}
```

**Workspace settings addition:**
```json
{
  "azureEnv.keyVault.defaultVault": "https://myteam-vault.vault.azure.net"
}
```

---

## 4. Disconnect Command

**File:** `src/commands/disconnect.ts`

**Purpose:** Clear configuration and environment variables.

**Flow:**
1. Confirm with user: "This will remove Azure Env configuration. Continue?"
2. Clear all `azureEnv.*` workspace settings
3. Clear environment variable collection
4. Hide tree view (set `azureEnv.configured` context to false)
5. Show confirmation message

**Implementation:**
```typescript
export async function executeDisconnect(): Promise<void> {
  const confirm = await vscode.window.showWarningMessage(
    'Remove Azure Env configuration from this workspace?',
    { modal: true },
    'Disconnect'
  );

  if (confirm !== 'Disconnect') return;

  const config = vscode.workspace.getConfiguration('azureEnv');
  await config.update('appConfiguration.endpoint', undefined, ConfigurationTarget.Workspace);
  await config.update('appConfiguration.selectedKeys', undefined, ConfigurationTarget.Workspace);
  await config.update('appConfiguration.label', undefined, ConfigurationTarget.Workspace);
  await config.update('keyVault.defaultVault', undefined, ConfigurationTarget.Workspace);

  envCollection.clear();
  vscode.commands.executeCommand('setContext', 'azureEnv.configured', false);

  vscode.window.showInformationMessage('Azure Env disconnected.');
}
```

---

## ~~5. Additional Commands for Tree View~~ ✅ COMPLETED

**Status:** Implemented as part of Tree View Provider (see section 1)

---

## 6. List Available Key Vaults

**App Config Service or new vaultService addition:**

For the "Add Secret" flow, we need to list available Key Vaults in a subscription.

```typescript
import { KeyVaultManagementClient } from '@azure/arm-keyvault';

async listVaults(subscriptionId: string): Promise<Array<{ name: string; vaultUri: string }>> {
  const client = new KeyVaultManagementClient(this.credential, subscriptionId);
  const vaults: Array<{ name: string; vaultUri: string }> = [];

  for await (const vault of client.vaults.list()) {
    if (vault.name && vault.properties?.vaultUri) {
      vaults.push({
        name: vault.name,
        vaultUri: vault.properties.vaultUri,
      });
    }
  }

  return vaults;
}
```

**New dependency:**
```json
{
  "@azure/arm-keyvault": "^3.0.0"
}
```

---

## 7. Package.json Updates for MVP

```json
{
  "contributes": {
    "commands": [
      { "command": "azureEnv.connect", "title": "Azure Env: Connect to App Configuration" },
      { "command": "azureEnv.refresh", "title": "Azure Env: Refresh Environment" },
      { "command": "azureEnv.addConfig", "title": "Azure Env: Add Configuration Value" },
      { "command": "azureEnv.addSecret", "title": "Azure Env: Add Secret" },
      { "command": "azureEnv.disconnect", "title": "Azure Env: Disconnect" },
      { "command": "azureEnv.copyValue", "title": "Copy Value" },
      { "command": "azureEnv.copyKey", "title": "Copy Key Name" },
      { "command": "azureEnv.revealValue", "title": "Reveal Value" }
    ],
    "configuration": {
      "properties": {
        "azureEnv.keyVault.defaultVault": {
          "type": "string",
          "default": "",
          "description": "Default Key Vault for creating new secrets"
        }
      }
    },
    "viewsContainers": {
      "activitybar": [{
        "id": "azureEnv",
        "title": "Azure Env",
        "icon": "$(key)"
      }]
    },
    "views": {
      "azureEnv": [{
        "id": "azureEnv.environment",
        "name": "Environment",
        "when": "azureEnv.configured"
      }]
    }
  }
}
```

---

## 8. Updated Project Structure for MVP

```
azure-env/
├── src/
│   ├── extension.ts
│   ├── services/
│   │   ├── credentialService.ts
│   │   ├── appConfigService.ts    # + createSetting, createKeyVaultReference
│   │   └── keyVaultService.ts     # + createSecret, listVaults
│   ├── providers/
│   │   └── envTreeProvider.ts     # ✅ DONE
│   ├── commands/
│   │   ├── connect.ts
│   │   ├── refresh.ts
│   │   ├── addConfig.ts           # NEW
│   │   ├── addSecret.ts           # NEW
│   │   ├── disconnect.ts          # NEW
│   │   ├── copyValue.ts           # ✅ DONE
│   │   ├── copyKey.ts             # ✅ DONE
│   │   └── revealValue.ts         # ✅ DONE
│   └── models/
│       ├── settings.ts            # + defaultVault
│       ├── envTreeItem.ts         # ✅ DONE
│       ├── keyHierarchy.ts        # ✅ DONE
│       └── configValue.ts
```

---

## Implementation Order (After Core)

1. **Disconnect command** - Simple, standalone
2. ~~**Tree view provider** - Foundation for visual features~~ ✅
3. ~~**Copy/reveal commands** - Tree view context actions~~ ✅
4. **Add configuration value** - Write to App Config
5. **List Key Vaults** - Required for add secret
6. **Add secret command** - Most complex, depends on others

---

## Testing Additions for MVP

- ~~Tree view rendering with nested keys~~ ✅
- Add config creates setting with correct label
- Add secret creates Key Vault secret and optional reference
- Disconnect clears all state
- ~~Copy/reveal commands work from tree context~~ ✅

---

## Open Questions to Resolve Before MVP

1. **Missing keys:** Should extension warn when a configured key no longer exists? (Currently silently skipped)
2. ~~**Key prefixes in tree:** How deep should the hierarchy go? Show full paths or just organize visually?~~ ✅ Resolved: Full hierarchy with `/` delimiter
3. **Default vault selection:** Should connect flow prompt for default Key Vault, or leave for "Add Secret" to handle?

---

## ~~Enhancements for Connect Flow~~ ✅ COMPLETED

### ~~Prompt for Label During Setup~~ ✅

**Status:** Implemented in PR #2 (merged to master)

**Implementation:** See `specs/002-label-selection-plan.md` for details.

- Added `listLabels()` method to AppConfigService
- Connect flow now prompts for label when multiple labels exist
- Auto-selects when only one label exists
- Keys filtered by selected label
- Label saved to workspace settings for refresh
