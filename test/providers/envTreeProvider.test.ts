import { describe, it, expect, vi } from 'vitest';
import { EnvTreeProvider } from '../../src/providers/envTreeProvider';
import { EnvTreeItem } from '../../src/models/envTreeItem';
import { TreeItem, TreeItemCollapsibleState } from '../__mocks__/vscode';

const entries = [
  { key: 'App/Database/Host', value: 'localhost', isSecret: false },
  { key: 'App/Database/Password', value: 'secret', isSecret: true },
  { key: 'App/Redis/Host', value: 'redis', isSecret: false },
];

describe('EnvTreeProvider', () => {
  it('returns empty array when no data', () => {
    const provider = new EnvTreeProvider();

    expect(provider.getChildren()).toEqual([]);
  });

  it('populates tree after setData() is called', () => {
    const provider = new EnvTreeProvider();

    provider.setData(entries);
    expect(provider.getChildren()).toHaveLength(1);
  });

  it('fires onDidChangeTreeData on update', () => {
    const provider = new EnvTreeProvider();
    const listener = vi.fn();
    provider.onDidChangeTreeData(listener);

    provider.setData(entries);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('returns children for folder elements', () => {
    const provider = new EnvTreeProvider();
    provider.setData(entries);

    const appNode = provider.getChildren()[0];
    const children = provider.getChildren(appNode).map((child) => child.label).sort();

    expect(children).toEqual(['Database', 'Redis']);
  });

  it('clear() removes all data', () => {
    const provider = new EnvTreeProvider();
    provider.setData(entries);

    provider.clear();
    expect(provider.getChildren()).toEqual([]);
  });

  it('returns tree items for folders and leaves', () => {
    const provider = new EnvTreeProvider();
    provider.setData(entries);

    const appNode = provider.getChildren()[0];
    const appItem = provider.getTreeItem(appNode);

    expect(appItem).toBeInstanceOf(TreeItem);
    expect(appItem.label).toBe('App');
    expect(appItem.collapsibleState).toBe(TreeItemCollapsibleState.Collapsed);

    const dbNode = provider.getChildren(appNode).find((child) => child.label === 'Database');
    if (!dbNode) {
      throw new Error('Expected Database node');
    }

    const hostNode = provider.getChildren(dbNode).find((child) => child.label === 'Host');
    if (!hostNode) {
      throw new Error('Expected Host node');
    }

    const hostItem = provider.getTreeItem(hostNode);
    expect(hostItem).toBeInstanceOf(EnvTreeItem);
    expect(hostItem.label).toBe('Host');

    const passwordNode = provider
      .getChildren(dbNode)
      .find((child) => child.label === 'Password');
    if (!passwordNode) {
      throw new Error('Expected Password node');
    }
    const passwordItem = provider.getTreeItem(passwordNode) as EnvTreeItem;

    expect(passwordItem.description).toBe('••••••••');
  });
});
