import * as vscode from 'vscode';
import { EnvTreeItem } from '../models/envTreeItem';
import {
  buildKeyHierarchy,
  type ConfigValueEntry,
  type KeyHierarchyNode,
} from '../models/keyHierarchy';

export class EnvTreeProvider implements vscode.TreeDataProvider<KeyHierarchyNode> {
  private rootNodes: KeyHierarchyNode[] = [];
  private readonly emitter = new vscode.EventEmitter<KeyHierarchyNode | undefined>();

  readonly onDidChangeTreeData = this.emitter.event;

  getTreeItem(element: KeyHierarchyNode): vscode.TreeItem {
    if (element.isValue && element.children.length === 0) {
      const item = new EnvTreeItem(element.key, element.value ?? '', element.isSecret ?? false);
      item.label = element.label;
      return item;
    }

    const item = new vscode.TreeItem(element.label, element.collapsibleState);
    item.description = element.description;
    return item;
  }

  getChildren(element?: KeyHierarchyNode): KeyHierarchyNode[] {
    if (!element) {
      return this.rootNodes;
    }
    return element.children;
  }

  setData(entries: ConfigValueEntry[]): void {
    this.rootNodes = buildKeyHierarchy(entries);
    void vscode.commands.executeCommand('setContext', 'azureEnv.configured', true);
    this.emitter.fire(undefined);
  }

  clear(): void {
    this.rootNodes = [];
    void vscode.commands.executeCommand('setContext', 'azureEnv.configured', false);
    this.emitter.fire(undefined);
  }
}
