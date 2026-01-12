#!/bin/bash
set -e

RESOURCE_GROUP="azure-env-test"

echo "=== Azure Env Integration Test Cleanup ==="
echo ""

# Check if az CLI is authenticated
if ! az account show &>/dev/null; then
    echo "Error: Not logged in to Azure CLI. Run 'az login' first."
    exit 1
fi

# Check if resource group exists
if ! az group show --name "$RESOURCE_GROUP" &>/dev/null; then
    echo "Resource group '$RESOURCE_GROUP' does not exist. Nothing to clean up."
    exit 0
fi

echo "This will delete the following resources:"
echo "  - Resource Group: $RESOURCE_GROUP"
echo "  - App Configuration: azure-env-test-config"
echo "  - Key Vault: azure-env-test-kv"
echo "  - All RBAC role assignments on these resources"
echo ""

# Prompt for confirmation unless --yes flag is passed
if [[ "$1" != "--yes" && "$1" != "-y" ]]; then
    read -p "Are you sure you want to delete these resources? (y/N) " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo "Cleanup cancelled."
        exit 0
    fi
fi

echo "Deleting resource group '$RESOURCE_GROUP'..."
echo "(This will delete all resources in the group)"

az group delete --name "$RESOURCE_GROUP" --yes --no-wait

echo ""
echo "Deletion initiated (running in background)."
echo "Use 'az group show --name $RESOURCE_GROUP' to check status."
echo ""
echo "Note: Key Vault will be soft-deleted. To permanently purge:"
echo "  az keyvault purge --name azure-env-test-kv"
echo ""
