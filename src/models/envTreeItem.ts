import * as vscode from 'vscode';

const MASKED_VALUE = '••••••••';
const MAX_DESCRIPTION_LENGTH = 47; // Leave room for "..."

/**
 * Tree item representing an environment variable in the tree view.
 * Handles display formatting, secret masking, and icon selection.
 */
export class EnvTreeItem extends vscode.TreeItem {
  public readonly value: string;
  public readonly isSecret: boolean;

  constructor(key: string, value: string, isSecret: boolean) {
    super(key, vscode.TreeItemCollapsibleState.None);

    this.value = value;
    this.isSecret = isSecret;

    // Set description (displayed value)
    this.description = isSecret ? MASKED_VALUE : this.truncateValue(value);

    // Set context for menu visibility
    this.contextValue = isSecret ? 'secret' : 'configValue';

    // Set icon
    this.iconPath = new vscode.ThemeIcon(isSecret ? 'key' : 'symbol-constant');

    // Set tooltip
    this.tooltip = this.buildTooltip(key, isSecret);
  }

  private truncateValue(value: string): string {
    if (value.length <= MAX_DESCRIPTION_LENGTH) {
      return value;
    }
    return value.substring(0, MAX_DESCRIPTION_LENGTH) + '...';
  }

  private buildTooltip(key: string, isSecret: boolean): string {
    const lines = [key];
    if (isSecret) {
      lines.push('(Secret from Key Vault)');
    }
    return lines.join('\n');
  }
}
