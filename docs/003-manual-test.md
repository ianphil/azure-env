# Manual Test: Tree View + Context Actions

## Prerequisites

- Azure resources from `specs/001-integration-test-setup.md` (or run `./scripts/setup-azure-resources.sh`)
- Logged into Azure in VS Code
- Workspace is trusted

## Test Steps

### 1. Connect and Seed Data

1. Run `Azure Env: Connect to App Configuration`
2. Select subscription and `https://azure-env-test-config.azconfig.io`
3. Select label `integration-test`
4. Select keys:
   - `integration-test/plain-value`
   - `integration-test/secret-ref`
5. **Expected**: Status bar shows connected

### 2. Tree View Renders Hierarchy

1. Open Activity Bar and select **Azure Env** (key icon)
2. Expand **Environment**
3. **Expected**: `integration-test` folder with two items: `plain-value`, `secret-ref`

### 3. Masking and Icons

1. **Expected**: `plain-value` shows actual value with constant icon
2. **Expected**: `secret-ref` shows masked value with key icon

### 4. Context Menu Actions

1. Right-click `plain-value` → **Copy Value**
2. Paste somewhere
3. **Expected**: Clipboard contains the plain value
4. Right-click `plain-value` → **Copy Key Name**
5. Paste somewhere
6. **Expected**: Clipboard contains `integration-test/plain-value`
7. Right-click `secret-ref` → **Reveal Value**
8. Confirm **Reveal**
9. **Expected**: Secret value is shown

### 5. Refresh Updates Tree

1. Update the plain value:
   ```bash
   az appconfig kv set --name azure-env-test-config --key "integration-test/plain-value" --label integration-test --value "updated-value" -y
   ```
2. Run `Azure Env: Refresh Environment`
3. **Expected**: Tree item `plain-value` updates to `updated-value`
