#!/bin/bash
set -e

# Configuration
RESOURCE_GROUP="azure-env-test"
LOCATION="eastus"
APP_CONFIG_NAME="azure-env-test-config"
KEY_VAULT_NAME="azure-env-test-kv"

# Test data configuration
TEST_SECRET_NAME="integration-test-secret"
TEST_SECRET_VALUE="test-secret-value-$(date +%s)"
TEST_CONFIG_KEY="integration-test/plain-value"
TEST_CONFIG_VALUE="test-config-value"
TEST_KV_REF_KEY="integration-test/secret-ref"

echo "=== Azure Env Integration Test Setup ==="
echo ""

# Check if az CLI is authenticated
if ! az account show &>/dev/null; then
    echo "Error: Not logged in to Azure CLI. Run 'az login' first."
    exit 1
fi

echo "Using subscription: $(az account show --query name -o tsv)"
echo ""

# Create resource group
echo "1. Creating resource group '$RESOURCE_GROUP'..."
if az group show --name "$RESOURCE_GROUP" &>/dev/null; then
    echo "   Resource group already exists, skipping."
else
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION" --output none
    echo "   Created."
fi

# Create App Configuration store (Free tier)
echo "2. Creating App Configuration store '$APP_CONFIG_NAME' (Free tier)..."
if az appconfig show --name "$APP_CONFIG_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    echo "   App Configuration store already exists, skipping."
else
    az appconfig create \
        --name "$APP_CONFIG_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --sku Free \
        --output none
    echo "   Created."
fi

# Create Key Vault (Standard tier)
echo "3. Creating Key Vault '$KEY_VAULT_NAME' (Standard tier)..."
if az keyvault show --name "$KEY_VAULT_NAME" --resource-group "$RESOURCE_GROUP" &>/dev/null; then
    echo "   Key Vault already exists, skipping."
else
    az keyvault create \
        --name "$KEY_VAULT_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --location "$LOCATION" \
        --sku standard \
        --enable-rbac-authorization true \
        --output none
    echo "   Created."
fi

# Get resource IDs
echo "4. Getting resource IDs..."
USER_ID=$(az ad signed-in-user show --query id -o tsv)
APP_CONFIG_ID=$(az appconfig show --name "$APP_CONFIG_NAME" --resource-group "$RESOURCE_GROUP" --query id -o tsv)
KEY_VAULT_ID=$(az keyvault show --name "$KEY_VAULT_NAME" --resource-group "$RESOURCE_GROUP" --query id -o tsv)

# Assign RBAC roles
echo "5. Assigning RBAC roles..."

# Helper function to check if role is assigned (az role assignment list returns 0 even when empty)
role_exists() {
    local assignee="$1"
    local scope="$2"
    local role="$3"
    [ -n "$(az role assignment list --assignee "$assignee" --scope "$scope" --role "$role" --query "[0].id" -o tsv 2>/dev/null)" ]
}

# App Configuration Data Owner (read + write)
if role_exists "$USER_ID" "$APP_CONFIG_ID" "App Configuration Data Owner"; then
    echo "   App Configuration Data Owner already assigned, skipping."
else
    az role assignment create \
        --role "App Configuration Data Owner" \
        --assignee "$USER_ID" \
        --scope "$APP_CONFIG_ID" \
        --output none
    echo "   Assigned App Configuration Data Owner."
fi

# Key Vault Secrets Officer (read + write)
if role_exists "$USER_ID" "$KEY_VAULT_ID" "Key Vault Secrets Officer"; then
    echo "   Key Vault Secrets Officer already assigned, skipping."
else
    az role assignment create \
        --role "Key Vault Secrets Officer" \
        --assignee "$USER_ID" \
        --scope "$KEY_VAULT_ID" \
        --output none
    echo "   Assigned Key Vault Secrets Officer."
fi

VAULT_URL="https://${KEY_VAULT_NAME}.vault.azure.net"
ENDPOINT=$(az appconfig show --name "$APP_CONFIG_NAME" --resource-group "$RESOURCE_GROUP" --query endpoint -o tsv)

# Poll for RBAC access
echo "6. Waiting for RBAC propagation..."

MAX_ATTEMPTS=30
POLL_INTERVAL=10

# Poll Key Vault write access
echo "   Checking Key Vault write access..."
attempt=1
while [ $attempt -le $MAX_ATTEMPTS ]; do
    if az keyvault secret set --vault-name "$KEY_VAULT_NAME" --name "$TEST_SECRET_NAME" --value "$TEST_SECRET_VALUE" --output none 2>/dev/null; then
        echo "   Key Vault write access confirmed."
        break
    fi
    if [ $attempt -eq $MAX_ATTEMPTS ]; then
        echo "   ERROR: Key Vault write access not available after $((MAX_ATTEMPTS * POLL_INTERVAL)) seconds."
        exit 1
    fi
    echo "   Attempt $attempt/$MAX_ATTEMPTS - waiting ${POLL_INTERVAL}s..."
    sleep $POLL_INTERVAL
    ((attempt++))
done

# Poll Key Vault read access
echo "   Checking Key Vault read access..."
attempt=1
while [ $attempt -le $MAX_ATTEMPTS ]; do
    if az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "$TEST_SECRET_NAME" --output none 2>/dev/null; then
        echo "   Key Vault read access confirmed."
        break
    fi
    if [ $attempt -eq $MAX_ATTEMPTS ]; then
        echo "   ERROR: Key Vault read access not available after $((MAX_ATTEMPTS * POLL_INTERVAL)) seconds."
        exit 1
    fi
    echo "   Attempt $attempt/$MAX_ATTEMPTS - waiting ${POLL_INTERVAL}s..."
    sleep $POLL_INTERVAL
    ((attempt++))
done

# Poll App Configuration write access
echo "   Checking App Configuration write access..."
attempt=1
while [ $attempt -le $MAX_ATTEMPTS ]; do
    if az appconfig kv set --name "$APP_CONFIG_NAME" --key "$TEST_CONFIG_KEY" --value "$TEST_CONFIG_VALUE" --label "integration-test" --yes --output none 2>/dev/null; then
        echo "   App Configuration write access confirmed."
        break
    fi
    if [ $attempt -eq $MAX_ATTEMPTS ]; then
        echo "   ERROR: App Configuration write access not available after $((MAX_ATTEMPTS * POLL_INTERVAL)) seconds."
        exit 1
    fi
    echo "   Attempt $attempt/$MAX_ATTEMPTS - waiting ${POLL_INTERVAL}s..."
    sleep $POLL_INTERVAL
    ((attempt++))
done

# Poll App Configuration read access
echo "   Checking App Configuration read access..."
attempt=1
while [ $attempt -le $MAX_ATTEMPTS ]; do
    if az appconfig kv show --name "$APP_CONFIG_NAME" --key "$TEST_CONFIG_KEY" --label "integration-test" --output none 2>/dev/null; then
        echo "   App Configuration read access confirmed."
        break
    fi
    if [ $attempt -eq $MAX_ATTEMPTS ]; then
        echo "   ERROR: App Configuration read access not available after $((MAX_ATTEMPTS * POLL_INTERVAL)) seconds."
        exit 1
    fi
    echo "   Attempt $attempt/$MAX_ATTEMPTS - waiting ${POLL_INTERVAL}s..."
    sleep $POLL_INTERVAL
    ((attempt++))
done

# Seed remaining test data
echo "7. Seeding test data..."

# Create Key Vault reference in App Configuration
echo "   Creating Key Vault reference in App Configuration..."
SECRET_URI="${VAULT_URL}/secrets/${TEST_SECRET_NAME}"
az appconfig kv set-keyvault \
    --name "$APP_CONFIG_NAME" \
    --key "$TEST_KV_REF_KEY" \
    --secret-identifier "$SECRET_URI" \
    --label "integration-test" \
    --yes \
    --output none

# Verify all test data is accessible
echo "8. Verifying test data..."
echo -n "   Key Vault secret: "
az keyvault secret show --vault-name "$KEY_VAULT_NAME" --name "$TEST_SECRET_NAME" --query "name" -o tsv
echo -n "   App Config plain value: "
az appconfig kv show --name "$APP_CONFIG_NAME" --key "$TEST_CONFIG_KEY" --label "integration-test" --query "key" -o tsv
echo -n "   App Config KV reference: "
az appconfig kv show --name "$APP_CONFIG_NAME" --key "$TEST_KV_REF_KEY" --label "integration-test" --query "key" -o tsv

echo ""
echo "=== Setup Complete ==="
echo ""
echo "Resources created:"
echo "  - Resource Group: $RESOURCE_GROUP"
echo "  - App Configuration: $APP_CONFIG_NAME (Free tier)"
echo "  - Key Vault: $KEY_VAULT_NAME (Standard tier)"
echo ""
echo "Test data seeded:"
echo "  - Secret: $TEST_SECRET_NAME"
echo "  - Config key: $TEST_CONFIG_KEY"
echo "  - Key Vault ref: $TEST_KV_REF_KEY"
echo ""
echo "Run integration tests with:"
echo ""
echo "  export AZURE_APPCONFIG_ENDPOINT=\"$ENDPOINT\""
echo "  export AZURE_KEYVAULT_URL=\"$VAULT_URL\""
echo "  npm run test:integration"
echo ""
