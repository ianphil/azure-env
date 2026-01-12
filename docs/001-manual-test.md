# Manual Test: Core Functionality

## Prerequisites

- Azure resources from `specs/001-integration-test-setup.md`:
  - App Config: `https://azure-env-test-config.azconfig.io`
  - Key Vault: `https://azure-env-test-kv.vault.azure.net`
- Logged into Azure in VS Code

## Test Steps

### 1. Connect to App Configuration

1. Open Command Palette (`Ctrl+Shift+P`)
2. Run `Azure Env: Connect to App Configuration`
3. Enter endpoint: `https://azure-env-test-config.azconfig.io`
4. **Expected**: Status bar shows "Azure Env: Connected"

### 2. Verify Environment Variables

1. Open a new terminal (`Ctrl+``)
2. Run `env | grep <your-key>` (Linux/Mac) or `set` (Windows)
3. **Expected**: Your App Configuration keys appear as environment variables

### 3. Refresh Environment

1. Run `Azure Env: Refresh Environment` from Command Palette
2. **Expected**: Status bar briefly shows "Refreshing...", then "Connected"
3. New terminals should have updated values

### 4. Key Vault Resolution (if configured)

1. Add a Key Vault reference in App Configuration
2. Refresh environment
3. **Expected**: Secret value is resolved and injected (not the reference URI)

### 5. Error Handling

1. Disconnect from network or use invalid endpoint
2. Try to refresh
3. **Expected**: Error notification appears, status bar shows error state

## Settings to Test

In VS Code settings (`Ctrl+,`), search for "Azure Env":

- `azureEnv.appConfiguration.endpoint` - `https://azure-env-test-config.azconfig.io`
- `azureEnv.appConfiguration.keyFilter` - Filter pattern (e.g., `myapp/*`)
- `azureEnv.appConfiguration.label` - Label filter
- `azureEnv.appConfiguration.selectedKeys` - Specific keys to inject
