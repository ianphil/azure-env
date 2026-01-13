import * as vscode from 'vscode';

export interface ConfigValueEntry {
  key: string;
  value: string;
  isSecret: boolean;
}

export interface KeyHierarchyNode {
  label: string;
  key: string;
  children: KeyHierarchyNode[];
  value?: string;
  isSecret?: boolean;
  isValue: boolean;
  collapsibleState: vscode.TreeItemCollapsibleState;
  description?: string;
}

export function splitKeyPath(key: string): string[] {
  return key.split('/').filter((segment) => segment.length > 0);
}

export function buildKeyHierarchy(entries: ConfigValueEntry[]): KeyHierarchyNode[] {
  const roots: KeyHierarchyNode[] = [];

  for (const entry of entries) {
    const segments = splitKeyPath(entry.key);
    if (segments.length === 0) {
      continue;
    }

    let currentNodes = roots;
    let currentPath = '';

    for (let index = 0; index < segments.length; index++) {
      const segment = segments[index];
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;

      let node = currentNodes.find((child) => child.label === segment);
      if (!node) {
        node = {
          label: segment,
          key: currentPath,
          children: [],
          isValue: false,
          collapsibleState: vscode.TreeItemCollapsibleState.None,
        };
        currentNodes.push(node);
      }

      if (index === segments.length - 1) {
        node.isValue = true;
        node.value = entry.value;
        node.isSecret = entry.isSecret;
      }

      currentNodes = node.children;
    }
  }

  updateNodeState(roots);
  sortNodes(roots);
  return roots;
}

function updateNodeState(nodes: KeyHierarchyNode[]): void {
  for (const node of nodes) {
    updateNodeState(node.children);

    if (node.children.length > 0) {
      node.collapsibleState = vscode.TreeItemCollapsibleState.Collapsed;
      const itemCount = `${node.children.length} item${node.children.length === 1 ? '' : 's'}`;
      // If this folder node also has its own value, indicate that
      if (node.isValue) {
        node.description = `${itemCount} (has value)`;
      } else {
        node.description = itemCount;
      }
    } else {
      node.collapsibleState = vscode.TreeItemCollapsibleState.None;
      node.description = undefined;
    }
  }
}

function sortNodes(nodes: KeyHierarchyNode[]): void {
  nodes.sort((a, b) => a.label.localeCompare(b.label));
  for (const node of nodes) {
    sortNodes(node.children);
  }
}
