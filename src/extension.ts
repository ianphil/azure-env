import * as vscode from 'vscode';

// Azure auth packages
import { VSCodeAzureSubscriptionProvider } from '@microsoft/vscode-azext-azureauth';
import {
  registerUIExtensionVariables,
  createAzExtOutputChannel,
} from '@microsoft/vscode-azext-utils';

// Azure SDK packages
import { AppConfigurationClient } from '@azure/app-configuration';
import { AppConfigurationManagementClient } from '@azure/arm-appconfiguration';
import { SecretClient } from '@azure/keyvault-secrets';
import { DefaultAzureCredential } from '@azure/identity';

let subscriptionProvider: VSCodeAzureSubscriptionProvider | undefined;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  // Register extension variables for vscode-azext-utils
  const outputChannel = createAzExtOutputChannel('Azure Env', 'azureEnv');
  registerUIExtensionVariables({ context, outputChannel });

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('azureEnv.connect', () => connectCommand(context)),
    vscode.commands.registerCommand('azureEnv.refresh', () => refreshCommand(context))
  );

  // Auto-refresh if already configured
  const config = vscode.workspace.getConfiguration('azureEnv.appConfiguration');
  const endpoint = config.get<string>('endpoint');
  if (endpoint) {
    setTimeout(() => refreshCommand(context), 2000);
  }

  outputChannel.appendLog('Azure Env extension activated');
}

async function connectCommand(context: vscode.ExtensionContext): Promise<void> {
  try {
    // Create subscription provider (uses VS Code's built-in Microsoft auth)
    subscriptionProvider = new VSCodeAzureSubscriptionProvider();
    context.subscriptions.push(subscriptionProvider);

    // Check sign-in status and prompt if needed
    const isSignedIn = await subscriptionProvider.isSignedIn();
    if (!isSignedIn) {
      const success = await subscriptionProvider.signIn();
      if (!success) {
        vscode.window.showErrorMessage('Azure sign-in required');
        return;
      }
    }

    // List subscriptions
    const subscriptions = await subscriptionProvider.getSubscriptions(false);
    if (subscriptions.length === 0) {
      vscode.window.showWarningMessage('No Azure subscriptions found');
      return;
    }

    // Show subscription picker
    const subItems = subscriptions.map(sub => ({
      label: sub.name,
      description: sub.subscriptionId,
      subscription: sub,
    }));

    const selectedSub = await vscode.window.showQuickPick(subItems, {
      placeHolder: 'Select Azure subscription',
    });

    if (!selectedSub) return;

    // List App Configuration stores using ARM client
    const armClient = new AppConfigurationManagementClient(
      selectedSub.subscription.credential,
      selectedSub.subscription.subscriptionId
    );

    const stores: Array<{ name: string; endpoint: string }> = [];
    for await (const store of armClient.configurationStores.list()) {
      if (store.name && store.endpoint) {
        stores.push({ name: store.name, endpoint: store.endpoint });
      }
    }

    if (stores.length === 0) {
      vscode.window.showWarningMessage('No App Configuration stores found');
      return;
    }

    // Show store picker
    const storeItems = stores.map(s => ({
      label: s.name,
      description: s.endpoint,
      endpoint: s.endpoint,
    }));

    const selectedStore = await vscode.window.showQuickPick(storeItems, {
      placeHolder: 'Select App Configuration store',
    });

    if (!selectedStore) return;

    // List keys from the selected store
    const appConfigClient = new AppConfigurationClient(
      selectedStore.endpoint,
      selectedSub.subscription.credential
    );

    const keys: string[] = [];
    for await (const setting of appConfigClient.listConfigurationSettings()) {
      if (setting.key) {
        keys.push(setting.key);
      }
    }

    if (keys.length === 0) {
      vscode.window.showWarningMessage('No configuration keys found');
      return;
    }

    // Show key multi-select picker
    const keyItems = keys.map(k => ({ label: k, picked: false }));
    const selectedKeys = await vscode.window.showQuickPick(keyItems, {
      placeHolder: 'Select configuration keys',
      canPickMany: true,
    });

    if (!selectedKeys || selectedKeys.length === 0) return;

    // Save to workspace settings
    const config = vscode.workspace.getConfiguration('azureEnv.appConfiguration');
    await config.update('endpoint', selectedStore.endpoint, vscode.ConfigurationTarget.Workspace);
    await config.update('selectedKeys', selectedKeys.map(k => k.label), vscode.ConfigurationTarget.Workspace);

    vscode.window.showInformationMessage(`Connected to ${selectedStore.label}`);

    // Trigger refresh to inject env vars
    await refreshCommand(context);
  } catch (error) {
    vscode.window.showErrorMessage(`Connection failed: ${error}`);
  }
}

async function refreshCommand(context: vscode.ExtensionContext): Promise<void> {
  try {
    const config = vscode.workspace.getConfiguration('azureEnv.appConfiguration');
    const endpoint = config.get<string>('endpoint');
    const selectedKeys = config.get<string[]>('selectedKeys') || [];
    const label = config.get<string>('label') || undefined;

    if (!endpoint || selectedKeys.length === 0) {
      vscode.window.showWarningMessage('No App Configuration configured. Run "Azure Env: Connect" first.');
      return;
    }

    // Get credential - use DefaultAzureCredential which will pick up VS Code auth
    const credential = new DefaultAzureCredential();
    const appConfigClient = new AppConfigurationClient(endpoint, credential);

    // Fetch and resolve values
    const envCollection = context.environmentVariableCollection;
    envCollection.clear();

    let successCount = 0;
    let errorCount = 0;

    for (const key of selectedKeys) {
      try {
        const setting = await appConfigClient.getConfigurationSetting({ key, label });

        let value = setting.value || '';

        // Check for Key Vault reference
        if (setting.contentType?.includes('keyvaultref')) {
          const ref = JSON.parse(value) as { uri: string };
          value = await resolveKeyVaultSecret(ref.uri, credential);
        }

        // Transform key to env var name: MyService/Database/Host -> MYSERVICE_DATABASE_HOST
        const envName = key.replace(/\//g, '_').toUpperCase();
        envCollection.replace(envName, value);
        successCount++;
      } catch (err) {
        console.error(`Failed to fetch ${key}:`, err);
        errorCount++;
      }
    }

    if (errorCount > 0) {
      vscode.window.showWarningMessage(`Environment refreshed: ${successCount} succeeded, ${errorCount} failed`);
    } else {
      vscode.window.showInformationMessage(`Environment refreshed: ${successCount} variables injected`);
    }
  } catch (error) {
    vscode.window.showErrorMessage(`Refresh failed: ${error}`);
  }
}

async function resolveKeyVaultSecret(uri: string, credential: DefaultAzureCredential): Promise<string> {
  // Parse vault URL and secret name from URI
  // Format: https://myvault.vault.azure.net/secrets/MySecret
  const url = new URL(uri);
  const vaultUrl = `${url.protocol}//${url.host}`;
  const secretName = url.pathname.split('/')[2];

  const secretClient = new SecretClient(vaultUrl, credential);
  const secret = await secretClient.getSecret(secretName);

  return secret.value || '';
}

export function deactivate(): void {
  subscriptionProvider?.dispose();
}
