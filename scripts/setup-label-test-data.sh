#!/bin/bash
# Setup test data for label selection manual testing
# Usage: ./scripts/setup-label-test-data.sh [--cleanup]

set -e

APP_CONFIG_NAME="azure-env-test-config"

if [ "$1" == "--cleanup" ]; then
    echo "Cleaning up label test data..."
    az appconfig kv delete --name "$APP_CONFIG_NAME" --key "App/DatabaseUrl" --label dev -y 2>/dev/null || true
    az appconfig kv delete --name "$APP_CONFIG_NAME" --key "App/LogLevel" --label dev -y 2>/dev/null || true
    az appconfig kv delete --name "$APP_CONFIG_NAME" --key "App/DatabaseUrl" --label prod -y 2>/dev/null || true
    az appconfig kv delete --name "$APP_CONFIG_NAME" --key "App/LogLevel" --label prod -y 2>/dev/null || true
    echo "Done."
    exit 0
fi

echo "Setting up label test data in $APP_CONFIG_NAME..."

echo "Creating keys with 'dev' label..."
az appconfig kv set --name "$APP_CONFIG_NAME" --key "App/DatabaseUrl" --value "dev-db.example.com" --label dev -y
az appconfig kv set --name "$APP_CONFIG_NAME" --key "App/LogLevel" --value "debug" --label dev -y

echo "Creating keys with 'prod' label..."
az appconfig kv set --name "$APP_CONFIG_NAME" --key "App/DatabaseUrl" --value "prod-db.example.com" --label prod -y
az appconfig kv set --name "$APP_CONFIG_NAME" --key "App/LogLevel" --value "info" --label prod -y

echo ""
echo "Done. Test data created:"
echo "  - App/DatabaseUrl (dev) = dev-db.example.com"
echo "  - App/LogLevel (dev) = debug"
echo "  - App/DatabaseUrl (prod) = prod-db.example.com"
echo "  - App/LogLevel (prod) = info"
echo ""
echo "To clean up: ./scripts/setup-label-test-data.sh --cleanup"
