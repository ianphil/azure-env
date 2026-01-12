import * as vscode from 'vscode';
import type { QuickPickItem, QuickPickOptions } from 'vscode';
import { AppConfigurationManagementClient } from '@azure/arm-appconfiguration';
import { TokenCredential } from '@azure/identity';

import { AuthService } from './services/authService';
import { AppConfigService } from './services/appConfigService';
import { KeyVaultService } from './services/keyVaultService';
import { getSettings, saveSettings } from './models/settings';
import { runConnectFlow, StoreInfo, KeyInfo } from './commands/connect';
import { refreshEnvironment } from './commands/refresh';

/**
 * Type-safe wrapper for single-select quick pick.
 */
async function showQuickPickSingle<T extends QuickPickItem>(
  items: T[],
  options?: QuickPickOptions
): Promise<T | undefined> {
  return vscode.window.showQuickPick(items, options);
}

/**
 * Type-safe wrapper for multi-select quick pick.
 */
async function showQuickPickMulti<T extends QuickPickItem>(
  items: T[],
  options?: QuickPickOptions
): Promise<T[] | undefined> {
  return vscode.window.showQuickPick(items, { ...options, canPickMany: true });
}

let authService: AuthService | undefined;
let outputChannel: vscode.OutputChannel;

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  outputChannel = vscode.window.createOutputChannel('Azure Env');
  context.subscriptions.push(outputChannel);

  // Initialize AuthService once to avoid race conditions
  authService = new AuthService();
  context.subscriptions.push(authService.getProvider());

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('azureEnv.connect', () => connectCommand(context)),
    vscode.commands.registerCommand('azureEnv.refresh', () => refreshCommand(context))
  );

  // Auto-refresh if already configured
  const settings = getSettings();
  if (settings.endpoint && settings.selectedKeys.length > 0) {
    // Delay to avoid blocking activation
    setTimeout(() => refreshCommand(context), 2000);
  }

  outputChannel.appendLine('Azure Env extension activated');
}

async function connectCommand(context: vscode.ExtensionContext): Promise<void> {
  // Security: Require workspace trust
  if (!vscode.workspace.isTrusted) {
    vscode.window.showErrorMessage(
      'Azure Env requires workspace trust to connect to Azure resources'
    );
    return;
  }

  try {
    const result = await runConnectFlow({
      authService: authService!,
      showQuickPickSingle,
      showQuickPickMulti,
      saveSettings,
      listStores: async (subscriptionId, credential) => {
        return listAppConfigStores(subscriptionId, credential as TokenCredential);
      },
      listKeys: async (endpoint, credential) => {
        return listConfigKeys(endpoint, credential as TokenCredential);
      },
    });

    if (result.success) {
      vscode.window.showInformationMessage(`Connected to ${result.storeName}`);
      await refreshCommand(context);
    } else {
      handleConnectFailure(result.reason);
    }
  } catch (error) {
    outputChannel.appendLine(`Connect error: ${error}`);
    vscode.window.showErrorMessage(`Connection failed: ${error}`);
  }
}

function handleConnectFailure(reason: string): void {
  switch (reason) {
    case 'auth_failed':
      vscode.window.showErrorMessage('Azure sign-in required');
      break;
    case 'no_subscriptions':
      vscode.window.showWarningMessage('No Azure subscriptions found');
      break;
    case 'no_stores':
      vscode.window.showWarningMessage('No App Configuration stores found');
      break;
    case 'no_keys':
      vscode.window.showWarningMessage('No configuration keys found');
      break;
    case 'no_keys_selected':
      vscode.window.showWarningMessage('No keys selected');
      break;
    case 'cancelled':
      // User cancelled, no message needed
      break;
    default:
      vscode.window.showErrorMessage(`Connection failed: ${reason}`);
  }
}

async function refreshCommand(context: vscode.ExtensionContext): Promise<void> {
  // Security: Require workspace trust
  if (!vscode.workspace.isTrusted) {
    vscode.window.showErrorMessage(
      'Azure Env requires workspace trust to connect to Azure resources'
    );
    return;
  }

  try {
    const settings = getSettings();

    if (!settings.endpoint || settings.selectedKeys.length === 0) {
      vscode.window.showWarningMessage('No App Configuration configured. Run "Azure Env: Connect" first.');
      return;
    }

    // Ensure signed in (authService initialized in activate)
    const isSignedIn = await authService!.ensureSignedIn();
    if (!isSignedIn) {
      vscode.window.showErrorMessage('Azure sign-in required');
      return;
    }

    // Get credential from subscription
    const subscriptions = await authService!.getSubscriptions();
    if (subscriptions.length === 0) {
      vscode.window.showErrorMessage('No Azure subscriptions available');
      return;
    }

    // Use first subscription's credential (could be improved to remember selected subscription)
    const credential = subscriptions[0].credential;

    // Create services
    const appConfigService = new AppConfigService(settings.endpoint, credential);
    const keyVaultService = new KeyVaultService(credential);

    // Refresh environment
    const result = await refreshEnvironment({
      selectedKeys: settings.selectedKeys,
      label: settings.label,
      envCollection: context.environmentVariableCollection,
      appConfigService,
      keyVaultService,
    });

    // Show result
    if (result.failed > 0) {
      const errorKeys = result.errors.map((e) => e.key).join(', ');
      outputChannel.appendLine(`Failed to resolve: ${errorKeys}`);
      result.errors.forEach((e) => outputChannel.appendLine(`  ${e.key}: ${e.error.message}`));
      vscode.window.showWarningMessage(
        `Environment refreshed: ${result.succeeded} succeeded, ${result.failed} failed`
      );
    } else {
      vscode.window.showInformationMessage(
        `Environment refreshed: ${result.succeeded} variables injected`
      );
    }
  } catch (error) {
    outputChannel.appendLine(`Refresh error: ${error}`);
    vscode.window.showErrorMessage(`Refresh failed: ${error}`);
  }
}

async function listAppConfigStores(
  subscriptionId: string,
  credential: TokenCredential
): Promise<StoreInfo[]> {
  const armClient = new AppConfigurationManagementClient(credential, subscriptionId);
  const stores: StoreInfo[] = [];

  for await (const store of armClient.configurationStores.list()) {
    if (store.name && store.endpoint) {
      stores.push({ name: store.name, endpoint: store.endpoint });
    }
  }

  return stores;
}

async function listConfigKeys(
  endpoint: string,
  credential: TokenCredential
): Promise<KeyInfo[]> {
  const appConfigService = new AppConfigService(endpoint, credential);
  const settings = await appConfigService.listSettings({});

  return settings
    .filter((s) => s.key)
    .map((s) => ({ key: s.key! }));
}

export function deactivate(): void {
  // Cleanup handled by disposables registered with context.subscriptions
}
