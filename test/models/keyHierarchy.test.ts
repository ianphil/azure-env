import { describe, it, expect } from 'vitest';
import { buildKeyHierarchy, splitKeyPath } from '../../src/models/keyHierarchy';
import { TreeItemCollapsibleState } from '../__mocks__/vscode';

describe('splitKeyPath', () => {
  it('splits key by "/" delimiter', () => {
    expect(splitKeyPath('MyService/Database/Host')).toEqual([
      'MyService',
      'Database',
      'Host',
    ]);
  });

  it('handles key without delimiters', () => {
    expect(splitKeyPath('SimpleKey')).toEqual(['SimpleKey']);
  });
});

describe('buildKeyHierarchy', () => {
  const entries = [
    { key: 'App/Database/Host', value: 'localhost', isSecret: false },
    { key: 'App/Database/Password', value: 'secret', isSecret: true },
    { key: 'App/Redis/Host', value: 'redis', isSecret: false },
  ];

  it('builds hierarchical tree from flat keys', () => {
    const tree = buildKeyHierarchy(entries);

    expect(tree).toHaveLength(1);
    expect(tree[0].label).toBe('App');

    const childLabels = tree[0].children.map((child) => child.label).sort();
    expect(childLabels).toEqual(['Database', 'Redis']);

    const dbNode = tree[0].children.find((child) => child.label === 'Database');
    const dbChildLabels = dbNode?.children.map((child) => child.label).sort();
    expect(dbChildLabels).toEqual(['Host', 'Password']);
  });

  it('sets folder nodes to Collapsed and leaf nodes to None', () => {
    const tree = buildKeyHierarchy(entries);

    const appNode = tree[0];
    const dbNode = appNode.children.find((child) => child.label === 'Database');
    const hostNode = dbNode?.children.find((child) => child.label === 'Host');

    expect(appNode.collapsibleState).toBe(TreeItemCollapsibleState.Collapsed);
    expect(hostNode?.collapsibleState).toBe(TreeItemCollapsibleState.None);
  });

  it('sets folder node descriptions with child counts', () => {
    const tree = buildKeyHierarchy(entries);

    const appNode = tree[0];
    const dbNode = appNode.children.find((child) => child.label === 'Database');

    expect(appNode.description).toBe('2 items');
    expect(dbNode?.description).toBe('2 items');
  });
});
