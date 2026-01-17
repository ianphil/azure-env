import * as vscode from 'vscode';
import type { QuickPickItem, QuickPickOptions } from 'vscode';
import { AppConfigurationManagementClient } from '@azure/arm-appconfiguration';
import { TokenCredential } from '@azure/identity';

import { AuthService } from './services/authService';
import { AppConfigService } from './services/appConfigService';
import { KeyVaultService } from './services/keyVaultService';
import { ScopedCredential } from './services/scopedCredential';
import { getSettings, saveSettings } from './models/settings';
import { runConnectFlow, StoreInfo, KeyInfo } from './commands/connect';
import { runAddConfigFlow } from './commands/addConfig';
import { refreshEnvironment } from './commands/refresh';
import { copyValueCommand } from './commands/copyValue';
import { copyKeyCommand } from './commands/copyKey';
import { revealValueCommand } from './commands/revealValue';
import type { EnvTreeItem } from './models/envTreeItem';
import { EnvTreeProvider } from './providers/envTreeProvider';
import { RefreshGuard } from './utils/refreshGuard';
import { StatusBarManager } from './ui/statusBar';
import { withProgress } from './ui/progress';

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
let statusBar: StatusBarManager | undefined;
let envTreeProvider: EnvTreeProvider | undefined;
let autoRefreshTimeout: ReturnType<typeof setTimeout> | undefined;
const refreshGuard = new RefreshGuard();

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  outputChannel = vscode.window.createOutputChannel('Azure Env');
  context.subscriptions.push(outputChannel);

  // Initialize AuthService once to avoid race conditions
  authService = new AuthService();
  context.subscriptions.push(authService.getProvider());

  // Initialize status bar
  statusBar = new StatusBarManager();
  context.subscriptions.push(statusBar);

  // Initialize tree view
  envTreeProvider = new EnvTreeProvider();
  const treeView = vscode.window.createTreeView('azureEnv.environment', {
    treeDataProvider: envTreeProvider,
  });
  context.subscriptions.push(treeView);
  context.subscriptions.push(envTreeProvider);

  // Register commands
  context.subscriptions.push(
    vscode.commands.registerCommand('azureEnv.connect', () => connectCommand(context)),
    vscode.commands.registerCommand('azureEnv.refresh', () => {
      // Cancel any pending auto-refresh to avoid double refresh
      if (autoRefreshTimeout) {
        clearTimeout(autoRefreshTimeout);
        autoRefreshTimeout = undefined;
      }
      return refreshCommand(context);
    }),
    vscode.commands.registerCommand('azureEnv.addConfig', () => addConfigCommand(context)),
    vscode.commands.registerCommand('azureEnv.copyValue', (item?: EnvTreeItem) =>
      copyValueCommand(item, {
        writeText: (value) => vscode.env.clipboard.writeText(value),
        showInformationMessage: (msg) => vscode.window.showInformationMessage(msg),
        showWarningMessage: (msg) => vscode.window.showWarningMessage(msg),
      })
    ),
    vscode.commands.registerCommand('azureEnv.copyKey', (item?: EnvTreeItem) =>
      copyKeyCommand(item, {
        writeText: (value) => vscode.env.clipboard.writeText(value),
        showInformationMessage: (msg) => vscode.window.showInformationMessage(msg),
        showWarningMessage: (msg) => vscode.window.showWarningMessage(msg),
      })
    ),
    vscode.commands.registerCommand('azureEnv.revealValue', (item?: EnvTreeItem) =>
      revealValueCommand(item, {
        showWarningMessage: (message, options, confirmLabel) =>
          vscode.window.showWarningMessage(message, options, confirmLabel),
        showInputBox: (options) => vscode.window.showInputBox(options),
      })
    )
  );

  // Set initial status bar state based on settings
  const settings = getSettings();
  if (settings.endpoint && settings.selectedKeys.length > 0) {
    // Show as connected (will verify on refresh)
    const storeName = extractStoreName(settings.endpoint);
    statusBar.setState('connected', storeName);

    // Delay to avoid blocking activation
    autoRefreshTimeout = setTimeout(() => {
      autoRefreshTimeout = undefined;
      refreshCommand(context);
    }, 2000);
  }

  outputChannel.appendLine('Azure Env extension activated');
}

/**
 * Extract the store name from an App Configuration endpoint URL.
 */
function extractStoreName(endpoint: string): string {
  try {
    const url = new URL(endpoint);
    // hostname is like "mystore.azconfig.io"
    return url.hostname.split('.')[0];
  } catch {
    return endpoint;
  }
}

async function connectCommand(context: vscode.ExtensionContext): Promise<void> {
  // Security: Require workspace trust
  if (!vscode.workspace.isTrusted) {
    vscode.window.showErrorMessage(
      'Azure Env requires workspace trust to connect to Azure resources'
    );
    return;
  }

  statusBar?.setState('connecting');

  try {
    const result = await runConnectFlow({
      authService: authService!,
      showQuickPickSingle,
      showQuickPickMulti,
      saveSettings,
      listStores: async (subscriptionId, credential) => {
        return listAppConfigStores(subscriptionId, credential as TokenCredential);
      },
      listLabels: async (endpoint, subscription) => {
        return listConfigLabels(endpoint, subscription);
      },
      listKeys: async (endpoint, subscription, label) => {
        return listConfigKeys(endpoint, subscription, label);
      },
    });

    if (result.success) {
      statusBar?.setState('connected', result.storeName);
      vscode.window.showInformationMessage(`Connected to ${result.storeName}`);
      await refreshCommand(context);
    } else {
      // Cancelled by user or no resources - stay disconnected
      if (result.reason !== 'cancelled') {
        handleConnectFailure(result.reason);
      }
      statusBar?.setState('disconnected');
    }
  } catch (error) {
    statusBar?.setState('error');
    outputChannel.appendLine(`[ERROR] Connect failed: ${error}`);
    if (error instanceof Error && error.stack) {
      outputChannel.appendLine(error.stack);
    }
    outputChannel.show(true); // Show output channel, preserve focus
    vscode.window.showErrorMessage(`Connection failed: ${error}`, 'Show Output').then((action) => {
      if (action === 'Show Output') {
        outputChannel.show();
      }
    });
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

async function addConfigCommand(context: vscode.ExtensionContext): Promise<void> {
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
      vscode.window.showWarningMessage(
        'No App Configuration configured. Run "Azure Env: Connect" first.'
      );
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

    let subscription = subscriptions.find(
      (s) => s.subscriptionId === settings.subscriptionId && s.tenantId === settings.tenantId
    );

    if (!subscription) {
      subscription = subscriptions.find((s) => s.subscriptionId === settings.subscriptionId);
    }

    if (!subscription) {
      outputChannel.appendLine(
        `[ERROR] Could not find subscription ${settings.subscriptionId} (tenant: ${settings.tenantId}). Available: ${subscriptions.map((s) => `${s.name} (${s.subscriptionId})`).join(', ')}`
      );
      vscode.window.showErrorMessage(
        'The Azure subscription used during setup is no longer available. Please run "Azure Env: Connect" again.'
      );
      return;
    }

    const credential = new ScopedCredential(subscription);
    const appConfigService = new AppConfigService(settings.endpoint, credential);
    const prefixes = getExistingPrefixes(settings.selectedKeys);

    const result = await runAddConfigFlow({
      showInputBox: (options) => vscode.window.showInputBox(options),
      showQuickPickSingle,
      getExistingPrefixes: async () => prefixes,
      createSetting: (key, value, label) => appConfigService.createSetting(key, value, label),
      refresh: () => refreshCommand(context),
      getLabel: () => settings.label,
    });

    if (result.success) {
      vscode.window.showInformationMessage(
        `Configuration value "${result.key}" added to App Configuration`
      );
    }
  } catch (error) {
    outputChannel.appendLine(`[ERROR] Add Configuration Value failed: ${error}`);
    if (error instanceof Error && error.stack) {
      outputChannel.appendLine(error.stack);
    }
    outputChannel.show(true);
    vscode.window
      .showErrorMessage(`Add Configuration Value failed: ${error}`, 'Show Output')
      .then((action) => {
        if (action === 'Show Output') {
          outputChannel.show();
        }
      });
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

  // Prevent concurrent refreshes
  if (!refreshGuard.tryStart()) {
    vscode.window.showWarningMessage('Environment refresh already in progress');
    return;
  }

  statusBar?.setState('refreshing');

  try {
    const settings = getSettings();

    if (!settings.endpoint || settings.selectedKeys.length === 0) {
      vscode.window.showWarningMessage(
        'No App Configuration configured. Run "Azure Env: Connect" first.'
      );
      statusBar?.setState('disconnected');
      envTreeProvider?.clear();
      return;
    }

    const storeName = extractStoreName(settings.endpoint);

    // Ensure signed in (authService initialized in activate)
    const isSignedIn = await authService!.ensureSignedIn();
    if (!isSignedIn) {
      vscode.window.showErrorMessage('Azure sign-in required');
      statusBar?.setState('error');
      return;
    }

    // Get credential from subscription
    const subscriptions = await authService!.getSubscriptions();
    if (subscriptions.length === 0) {
      vscode.window.showErrorMessage('No Azure subscriptions available');
      statusBar?.setState('error');
      return;
    }

    // Find the subscription that was used during connect
    let subscription = subscriptions.find(
      (s) => s.subscriptionId === settings.subscriptionId && s.tenantId === settings.tenantId
    );

    if (!subscription) {
      // Fallback: try matching just subscription ID (tenant might have changed)
      subscription = subscriptions.find((s) => s.subscriptionId === settings.subscriptionId);
    }

    if (!subscription) {
      outputChannel.appendLine(
        `[ERROR] Could not find subscription ${settings.subscriptionId} (tenant: ${settings.tenantId}). Available: ${subscriptions.map((s) => `${s.name} (${s.subscriptionId})`).join(', ')}`
      );
      vscode.window.showErrorMessage(
        'The Azure subscription used during setup is no longer available. Please run "Azure Env: Connect" again.'
      );
      statusBar?.setState('error');
      return;
    }

    const credential = new ScopedCredential(subscription);

    // Create services with scoped credential for data plane access
    const appConfigService = new AppConfigService(settings.endpoint, credential);
    const keyVaultService = new KeyVaultService(credential);

    // Refresh environment with progress indicator
    const result = await withProgress(
      {
        title: `Azure Env: Refreshing ${settings.selectedKeys.length} keys...`,
        cancellable: true,
      },
      async (progress, token) => {
        return refreshEnvironment({
          selectedKeys: settings.selectedKeys,
          label: settings.label,
          envCollection: context.environmentVariableCollection,
          appConfigService,
          keyVaultService,
          progress,
          cancellationToken: token,
        });
      }
    );

    envTreeProvider?.setData(result.items);

    // Show result and update status bar
    if (result.failed > 0) {
      const errorKeys = result.errors.map((e) => e.key).join(', ');
      outputChannel.appendLine(`Failed to resolve: ${errorKeys}`);
      result.errors.forEach((e) => outputChannel.appendLine(`  ${e.key}: ${e.error.message}`));
      vscode.window.showWarningMessage(
        `Environment refreshed: ${result.succeeded} succeeded, ${result.failed} failed`
      );
      // Partial success - show as connected with warning
      statusBar?.setState('connected', `${storeName} (${result.failed} errors)`);
    } else {
      vscode.window.showInformationMessage(
        `Environment refreshed: ${result.succeeded} variables injected`
      );
      statusBar?.setState('connected', `${storeName} (${result.succeeded} vars)`);
    }
  } catch (error) {
    outputChannel.appendLine(`[ERROR] Refresh failed: ${error}`);
    if (error instanceof Error && error.stack) {
      outputChannel.appendLine(error.stack);
    }
    outputChannel.show(true); // Show output channel, preserve focus
    vscode.window.showErrorMessage(`Refresh failed: ${error}`, 'Show Output').then((action) => {
      if (action === 'Show Output') {
        outputChannel.show();
      }
    });
    statusBar?.setState('error');
  } finally {
    refreshGuard.finish();
  }
}

function getExistingPrefixes(keys: string[]): string[] {
  const prefixes = new Set<string>();

  for (const key of keys) {
    const segments = key.split('/').filter((segment) => segment.length > 0);
    if (segments.length < 2) {
      continue;
    }

    let prefix = '';
    for (let index = 0; index < segments.length - 1; index++) {
      prefix = prefix ? `${prefix}/${segments[index]}` : segments[index];
      prefixes.add(`${prefix}/`);
    }
  }

  return Array.from(prefixes).sort();
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

async function listConfigLabels(endpoint: string, subscription: unknown): Promise<string[]> {
  const sub = subscription as import('@microsoft/vscode-azext-azureauth').AzureSubscription;
  const credential = new ScopedCredential(sub);
  const appConfigService = new AppConfigService(endpoint, credential);
  return appConfigService.listLabels();
}

async function listConfigKeys(
  endpoint: string,
  subscription: unknown,
  label: string
): Promise<KeyInfo[]> {
  const sub = subscription as import('@microsoft/vscode-azext-azureauth').AzureSubscription;
  const credential = new ScopedCredential(sub);
  const appConfigService = new AppConfigService(endpoint, credential);
  const settings = await appConfigService.listSettings({
    labelFilter: label || undefined,
  });

  return settings.filter((s) => s.key).map((s) => ({ key: s.key! }));
}

export function deactivate(): void {
  if (autoRefreshTimeout) {
    clearTimeout(autoRefreshTimeout);
    autoRefreshTimeout = undefined;
  }
}
