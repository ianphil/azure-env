import * as vscode from 'vscode';

/**
 * Connection state for the status bar display.
 */
export type ConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'error'
  | 'refreshing';

/**
 * Manages the status bar item for Azure Env extension.
 * Shows connection state and provides quick access to commands.
 */
export class StatusBarManager implements vscode.Disposable {
  private readonly statusBarItem: vscode.StatusBarItem;
  private state: ConnectionState = 'disconnected';
  private detail?: string;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Left,
      100
    );
    this.statusBarItem.command = 'azureEnv.connect';
    this.updateDisplay();
    this.statusBarItem.show();
  }

  /**
   * Update the connection state displayed in the status bar.
   */
  setState(state: ConnectionState, detail?: string): void {
    this.state = state;
    this.detail = detail;
    this.updateDisplay();
  }

  /**
   * Get the current connection state.
   */
  getState(): ConnectionState {
    return this.state;
  }

  private updateDisplay(): void {
    const icon = this.getIcon();
    const label = this.getLabel();

    this.statusBarItem.text = `${icon} ${label}`;
    this.statusBarItem.tooltip = this.getTooltip();
    this.statusBarItem.backgroundColor = this.getBackgroundColor();

    // Update command based on state
    this.statusBarItem.command =
      this.state === 'connected' ? 'azureEnv.refresh' : 'azureEnv.connect';
  }

  private getIcon(): string {
    switch (this.state) {
      case 'disconnected':
        return '$(cloud)';
      case 'connecting':
        return '$(sync~spin)';
      case 'connected':
        return '$(cloud-upload)';
      case 'error':
        return '$(cloud-offline)';
      case 'refreshing':
        return '$(sync~spin)';
    }
  }

  private getLabel(): string {
    switch (this.state) {
      case 'disconnected':
        return 'Azure Env';
      case 'connecting':
        return 'Azure Env: Connecting...';
      case 'connected':
        return this.detail ? `Azure Env: ${this.detail}` : 'Azure Env: Connected';
      case 'error':
        return 'Azure Env: Error';
      case 'refreshing':
        return 'Azure Env: Refreshing...';
    }
  }

  private getTooltip(): string {
    switch (this.state) {
      case 'disconnected':
        return 'Click to connect to Azure App Configuration';
      case 'connecting':
        return 'Authenticating with Azure...';
      case 'connected':
        return this.detail
          ? `Connected to ${this.detail}\nClick to refresh environment`
          : 'Click to refresh environment';
      case 'error':
        return 'Connection error - click to reconnect';
      case 'refreshing':
        return 'Fetching configuration values...';
    }
  }

  private getBackgroundColor(): vscode.ThemeColor | undefined {
    switch (this.state) {
      case 'error':
        return new vscode.ThemeColor('statusBarItem.errorBackground');
      default:
        return undefined;
    }
  }

  dispose(): void {
    this.statusBarItem.dispose();
  }
}
