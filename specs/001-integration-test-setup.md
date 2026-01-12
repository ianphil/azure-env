# Integration Test Setup with Azure Resources

## Overview

Create Azure resources and run integration tests using az CLI (already authenticated).

## Quick Start

```bash
# Create resources and seed test data
./scripts/setup-azure-resources.sh

# Set env vars (printed by setup script)
export AZURE_APPCONFIG_ENDPOINT="https://azure-env-test-config.azconfig.io"
export AZURE_KEYVAULT_URL="https://azure-env-test-kv.vault.azure.net"

# Run tests
npm run test:integration
```

## Cleanup

```bash
# Interactive (prompts for confirmation)
./scripts/cleanup-azure-resources.sh

# Non-interactive
./scripts/cleanup-azure-resources.sh --yes
```

---

## Resources Created

| Resource | Name | SKU |
|----------|------|-----|
| Resource Group | `azure-env-test` | - |
| App Configuration | `azure-env-test-config` | Free |
| Key Vault | `azure-env-test-kv` | Standard |

## RBAC Roles Assigned

| Role | Resource | Purpose |
|------|----------|---------|
| App Configuration Data Reader | App Configuration | Read config values in tests |
| App Configuration Data Owner | App Configuration | Seed test data |
| Key Vault Secrets User | Key Vault | Read secrets in tests |
| Key Vault Secrets Officer | Key Vault | Seed test secrets |

## Test Data Seeded

The setup script creates the following test data:

| Type | Key/Name | Value | Label |
|------|----------|-------|-------|
| Plain config | `integration-test/plain-value` | `test-config-value` | `integration-test` |
| Key Vault ref | `integration-test/secret-ref` | (reference to secret) | `integration-test` |
| Secret | `integration-test-secret` | `test-secret-value-{timestamp}` | - |

## Integration Tests

Tests are located in `test/integration/` and use the seeded test data:

- **appConfigService.integration.test.ts** - Tests App Configuration operations
  - List settings with filters
  - Get individual settings
  - Batch operations with mixed results

- **keyVaultService.integration.test.ts** - Tests Key Vault operations
  - Resolve secrets from URIs
  - Client caching behavior
  - Error handling for non-existent secrets

## Verification

After running `npm run test:integration`:

- Tests should NOT be skipped (env vars are set)
- Should see actual Azure API calls
- All tests should pass

## Troubleshooting

### Tests are skipped

Ensure environment variables are set:
```bash
echo $AZURE_APPCONFIG_ENDPOINT
echo $AZURE_KEYVAULT_URL
```

### Authentication errors

Make sure you're logged in to Azure CLI:
```bash
az login
az account show
```

### RBAC errors (403)

**This is the most common issue.** Azure RBAC role assignments can take **5-15 minutes** to fully propagate, sometimes longer.

**Symptoms:**
- Tests fail with 403 Forbidden (not 401 Unauthorized)
- `az appconfig kv list` works but SDK-based tests fail
- Key Vault tests may pass while App Configuration tests fail (propagation times vary)

**Important:** `az appconfig kv` commands use **access keys by default**, not RBAC. To test if RBAC has propagated, use:
```bash
az appconfig kv list --name azure-env-test-config --auth-mode login -o table
```

**Why this happens:**
- Authentication succeeds (token is valid)
- Authorization fails (role assignment not yet visible to the resource)
- Newly registered resource providers (like `Microsoft.AppConfiguration`) can have longer propagation times

**Solutions:**

1. **Wait and retry** - Most reliable option:
   ```bash
   # Wait 5-10 minutes after setup, then retry
   npm run test:integration
   ```

2. **Re-run role assignments** - Forces Azure to re-evaluate:
   ```bash
   USER_ID=$(az ad signed-in-user show --query id -o tsv)
   APP_CONFIG_ID=$(az appconfig show --name azure-env-test-config -g azure-env-test --query id -o tsv)

   # Delete and recreate role
   az role assignment delete --role "App Configuration Data Reader" --assignee "$USER_ID" --scope "$APP_CONFIG_ID"
   az role assignment create --role "App Configuration Data Reader" --assignee "$USER_ID" --scope "$APP_CONFIG_ID"

   # Wait 2-3 minutes, then retry
   ```

3. **Check role assignments exist**:
   ```bash
   az role assignment list --scope $(az appconfig show --name azure-env-test-config -g azure-env-test --query id -o tsv) -o table
   ```

### Resource provider not registered

If you see `MissingSubscriptionRegistration` errors:
```bash
az provider register --namespace Microsoft.AppConfiguration --wait
```

### Resource already exists

The setup script is idempotent - it checks for existing resources and skips creation if they exist.
