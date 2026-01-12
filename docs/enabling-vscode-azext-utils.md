# Enabling @microsoft/vscode-azext-utils

The `@microsoft/vscode-azext-utils` package provides common utilities for Azure VS Code extensions, including:

- Tree data providers (`AzExtTreeDataProvider`)
- Action context and error handling
- Telemetry integration
- UI utilities (quick picks, input boxes with validation)

However, it requires telemetry configuration to function. This document explains how to set it up.

## Prerequisites

1. An Azure Application Insights resource (for telemetry)
2. The Application Insights instrumentation key (aiKey)

## Step 1: Create Application Insights Resource (Optional)

If you want real telemetry:

1. Go to [Azure Portal](https://portal.azure.com)
2. Create a new **Application Insights** resource
3. Copy the **Instrumentation Key** from the Overview page

For development/testing, you can use a placeholder key (telemetry will fail silently).

## Step 2: Add aiKey to package.json

Add the `aiKey` field to your extension's `package.json`:

```json
{
  "name": "azure-env",
  "displayName": "Azure Env",
  "aiKey": "YOUR-APPLICATION-INSIGHTS-KEY",
  ...
}
```

For development without real telemetry, use a placeholder:

```json
{
  "aiKey": "00000000-0000-0000-0000-000000000000"
}
```

## Step 3: Install the Package

```bash
npm install @microsoft/vscode-azext-utils
```

## Step 4: Register Extension Variables

In your `extension.ts`, call `registerUIExtensionVariables` during activation:

```typescript
import * as vscode from 'vscode';
import {
  registerUIExtensionVariables,
  createAzExtOutputChannel,
  type IActionContext,
} from '@microsoft/vscode-azext-utils';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Create output channel with logging capabilities
  const outputChannel = createAzExtOutputChannel('Azure Env', 'azureEnv');

  // Register extension variables (required before using other utils)
  registerUIExtensionVariables({
    context,
    outputChannel,
  });

  // Now you can use other vscode-azext-utils features
  outputChannel.appendLog('Extension activated');

  // Register commands, etc.
}
```

## Step 5: Use Enhanced Features

Once registered, you can use the enhanced utilities:

### Logging with Timestamps

```typescript
outputChannel.appendLog('Operation started');
outputChannel.appendLog('Fetched 10 items', { resourceName: 'MyStore' });
```

### Action Context for Error Handling

```typescript
import { callWithTelemetryAndErrorHandling } from '@microsoft/vscode-azext-utils';

await callWithTelemetryAndErrorHandling('azureEnv.connect', async (context: IActionContext) => {
  context.telemetry.properties.subscriptionId = selectedSubscription.id;

  // Your command logic here
  // Errors are automatically caught and reported
});
```

### Tree Data Provider

```typescript
import { AzExtTreeDataProvider, AzExtParentTreeItem } from '@microsoft/vscode-azext-utils';

class RootTreeItem extends AzExtParentTreeItem {
  // Implementation
}

const treeDataProvider = new AzExtTreeDataProvider(rootTreeItem, 'azureEnv.loadMore');
const treeView = vscode.window.createTreeView('azureEnv.environment', { treeDataProvider });
```

## Disabling Telemetry

Users can disable telemetry via VS Code settings:

```json
{
  "telemetry.telemetryLevel": "off"
}
```

The extension should respect this setting. The `vscode-azext-utils` package handles this automatically.

## Common Issues

### "Extension's package.json is missing aiKey"

**Cause:** `registerUIExtensionVariables` was called but `package.json` doesn't have an `aiKey` field.

**Solution:** Add `"aiKey": "00000000-0000-0000-0000-000000000000"` to `package.json`.

### Telemetry Not Sending

**Cause:** Invalid aiKey or Application Insights resource not configured.

**Solution:** Verify the instrumentation key is correct and the Application Insights resource is active.

## References

- [@microsoft/vscode-azext-utils on npm](https://www.npmjs.com/package/@microsoft/vscode-azext-utils)
- [vscode-azuretools GitHub](https://github.com/microsoft/vscode-azuretools)
- [Azure Application Insights](https://docs.microsoft.com/en-us/azure/azure-monitor/app/app-insights-overview)
