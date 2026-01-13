# Manual Test: Label Selection in Connect Flow

## Prerequisites

- Azure resources from `specs/001-integration-test-setup.md`:
  - App Config: `https://azure-env-test-config.azconfig.io`
  - Key Vault: `https://azure-env-test-kv.vault.azure.net`
- Logged into Azure in VS Code
- App Configuration store with keys using multiple labels (e.g., `dev`, `prod`)

## Setup: Create Test Data

Before testing, ensure your App Configuration has keys with different labels:

```bash
# Add keys with 'dev' label
az appconfig kv set --name azure-env-test-config --key "App/DatabaseUrl" --value "dev-db.example.com" --label dev -y
az appconfig kv set --name azure-env-test-config --key "App/LogLevel" --value "debug" --label dev -y

# Add keys with 'prod' label
az appconfig kv set --name azure-env-test-config --key "App/DatabaseUrl" --value "prod-db.example.com" --label prod -y
az appconfig kv set --name azure-env-test-config --key "App/LogLevel" --value "info" --label prod -y

# Add keys with no label
az appconfig kv set --name azure-env-test-config --key "App/Version" --value "1.0.0" -y
```

## Test Steps

### 1. Connect with Multiple Labels Available

1. Clear any existing configuration in `.vscode/settings.json`
2. Open Command Palette (`Ctrl+Shift+P`)
3. Run `Azure Env: Connect to App Configuration`
4. Select your subscription
5. Select the App Configuration store
6. **Expected**: Label picker appears with options: `dev`, `prod`, `(no label)`
7. Select `dev`
8. **Expected**: Key picker shows only keys with `dev` label
9. Select keys and complete setup
10. **Expected**: `.vscode/settings.json` contains `"azureEnv.appConfiguration.label": "dev"`

### 2. Verify Label-Filtered Environment Variables

1. Open a new terminal
2. Run `echo $App_DatabaseUrl` (or equivalent for your OS)
3. **Expected**: Value is `dev-db.example.com` (the dev label value)

### 3. Connect with Single Label (Auto-Select)

1. Use an App Configuration store with only one label
2. Run `Azure Env: Connect to App Configuration`
3. **Expected**: No label picker appears (auto-selected)
4. **Expected**: Settings saved with the single label

### 4. Connect with No Labels (Auto-Select Empty)

1. Use an App Configuration store with keys that have no labels
2. Run `Azure Env: Connect to App Configuration`
3. **Expected**: No label picker appears
4. **Expected**: Settings saved with `"label": ""`

### 5. Cancel Label Selection

1. Run `Azure Env: Connect to App Configuration`
2. Select subscription and store
3. When label picker appears, press `Escape`
4. **Expected**: Flow cancelled, no settings saved

### 6. Refresh Uses Saved Label

1. Complete setup with `dev` label
2. Run `Azure Env: Refresh Environment`
3. **Expected**: Refresh succeeds, uses `dev` label from settings
4. Verify environment variables match `dev` label values

## Settings Verification

After connecting, check `.vscode/settings.json`:

```json
{
  "azureEnv.appConfiguration.endpoint": "https://azure-env-test-config.azconfig.io",
  "azureEnv.appConfiguration.label": "dev",
  "azureEnv.appConfiguration.selectedKeys": [
    "App/DatabaseUrl",
    "App/LogLevel"
  ],
  "azureEnv.appConfiguration.subscriptionId": "...",
  "azureEnv.appConfiguration.tenantId": "..."
}
```

## Cleanup

```bash
# Remove test keys
az appconfig kv delete --name azure-env-test-config --key "App/DatabaseUrl" --label dev -y
az appconfig kv delete --name azure-env-test-config --key "App/LogLevel" --label dev -y
az appconfig kv delete --name azure-env-test-config --key "App/DatabaseUrl" --label prod -y
az appconfig kv delete --name azure-env-test-config --key "App/LogLevel" --label prod -y
az appconfig kv delete --name azure-env-test-config --key "App/Version" -y
```
