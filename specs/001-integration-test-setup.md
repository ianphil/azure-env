# Integration Test Setup with Azure Resources

## Overview

Create Azure resources and run integration tests using az CLI (already authenticated).

---

## Step 1: Create Resource Group

```bash
az group create --name azure-env-test --location eastus
```

## Step 2: Create App Configuration Store

```bash
# Create the store (Free tier)
az appconfig create \
  --name azure-env-test-config \
  --resource-group azure-env-test \
  --location eastus \
  --sku Free

# Get and save the endpoint
az appconfig show --name azure-env-test-config --query endpoint -o tsv
```

## Step 3: Create Key Vault

```bash
# Create Key Vault
az keyvault create \
  --name azure-env-test-kv \
  --resource-group azure-env-test \
  --location eastus
```

## Step 4: Assign RBAC Roles

```bash
# App Configuration Data Reader
az role assignment create \
  --role "App Configuration Data Reader" \
  --assignee $(az ad signed-in-user show --query id -o tsv) \
  --scope $(az appconfig show --name azure-env-test-config --query id -o tsv)

# Key Vault Secrets User
az role assignment create \
  --role "Key Vault Secrets User" \
  --assignee $(az ad signed-in-user show --query id -o tsv) \
  --scope $(az keyvault show --name azure-env-test-kv --query id -o tsv)
```

## Step 5: Set Environment Variables and Run Tests

```bash
# Set the environment variables
export AZURE_APPCONFIG_ENDPOINT="https://azure-env-test-config.azconfig.io"
export AZURE_KEYVAULT_URL="https://azure-env-test-kv.vault.azure.net"

# Run integration tests
npm run test:integration
```

## Verification

- Tests should NOT be skipped
- Should see actual Azure API calls
- Tests should pass (even for non-existent keys - tests handle 404s)

## Cleanup (Optional)

```bash
# Delete the resource group (removes all resources)
az group delete --name azure-env-test --yes --no-wait
```
