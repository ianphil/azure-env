import * as vscode from 'vscode';

/**
 * Azure Env workspace settings stored in .vscode/settings.json
 */
export interface AzureEnvSettings {
  endpoint: string;
  selectedKeys: string[];
  label: string;
  keyFilter: string;
  subscriptionId: string;
  tenantId: string;
}

const CONFIG_SECTION = 'azureEnv.appConfiguration';

/**
 * Get current Azure Env settings from workspace configuration.
 */
export function getSettings(): AzureEnvSettings {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  return {
    endpoint: config.get<string>('endpoint') ?? '',
    selectedKeys: config.get<string[]>('selectedKeys') ?? [],
    label: config.get<string>('label') ?? '',
    keyFilter: config.get<string>('keyFilter') ?? '*',
    subscriptionId: config.get<string>('subscriptionId') ?? '',
    tenantId: config.get<string>('tenantId') ?? '',
  };
}

/**
 * Save Azure Env settings to workspace configuration.
 * Only saves fields that are provided.
 */
export async function saveSettings(settings: Partial<AzureEnvSettings>): Promise<void> {
  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);

  if (settings.endpoint !== undefined) {
    await config.update('endpoint', settings.endpoint, vscode.ConfigurationTarget.Workspace);
  }
  if (settings.selectedKeys !== undefined) {
    await config.update(
      'selectedKeys',
      settings.selectedKeys,
      vscode.ConfigurationTarget.Workspace
    );
  }
  if (settings.label !== undefined) {
    await config.update('label', settings.label, vscode.ConfigurationTarget.Workspace);
  }
  if (settings.keyFilter !== undefined) {
    await config.update('keyFilter', settings.keyFilter, vscode.ConfigurationTarget.Workspace);
  }
  if (settings.subscriptionId !== undefined) {
    await config.update('subscriptionId', settings.subscriptionId, vscode.ConfigurationTarget.Workspace);
  }
  if (settings.tenantId !== undefined) {
    await config.update('tenantId', settings.tenantId, vscode.ConfigurationTarget.Workspace);
  }
}
