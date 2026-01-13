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

  it('filters out empty segments from double slashes', () => {
    expect(splitKeyPath('App//Database')).toEqual(['App', 'Database']);
  });

  it('handles leading and trailing slashes', () => {
    expect(splitKeyPath('/App/Database/')).toEqual(['App', 'Database']);
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

    const childLabels = tree[0].children.map((child) => child.label);
    expect(childLabels).toEqual(['Database', 'Redis']);

    const dbNode = tree[0].children.find((child) => child.label === 'Database');
    const dbChildLabels = dbNode?.children.map((child) => child.label);
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

  it('sorts nodes alphabetically', () => {
    const unsortedEntries = [
      { key: 'Zebra/Config', value: 'z', isSecret: false },
      { key: 'Apple/Config', value: 'a', isSecret: false },
      { key: 'Mango/Config', value: 'm', isSecret: false },
    ];
    const tree = buildKeyHierarchy(unsortedEntries);

    const labels = tree.map((node) => node.label);
    expect(labels).toEqual(['Apple', 'Mango', 'Zebra']);
  });

  it('sorts nested nodes alphabetically', () => {
    const unsortedEntries = [
      { key: 'App/Zebra', value: 'z', isSecret: false },
      { key: 'App/Apple', value: 'a', isSecret: false },
    ];
    const tree = buildKeyHierarchy(unsortedEntries);

    const childLabels = tree[0].children.map((child) => child.label);
    expect(childLabels).toEqual(['Apple', 'Zebra']);
  });

  it('handles unicode characters in keys', () => {
    const unicodeEntries = [
      { key: 'App/数据库/Host', value: 'localhost', isSecret: false },
      { key: 'App/Données/Config', value: 'value', isSecret: false },
    ];
    const tree = buildKeyHierarchy(unicodeEntries);

    const childLabels = tree[0].children.map((child) => child.label);
    expect(childLabels).toContain('数据库');
    expect(childLabels).toContain('Données');
  });

  it('handles overlapping keys (node is both folder and value)', () => {
    const overlappingEntries = [
      { key: 'App/DB', value: 'connection-string', isSecret: false },
      { key: 'App/DB/Host', value: 'localhost', isSecret: false },
      { key: 'App/DB/Port', value: '5432', isSecret: false },
    ];
    const tree = buildKeyHierarchy(overlappingEntries);

    const dbNode = tree[0].children.find((child) => child.label === 'DB');

    // DB node should be both a value and have children
    expect(dbNode?.isValue).toBe(true);
    expect(dbNode?.value).toBe('connection-string');
    expect(dbNode?.children).toHaveLength(2);

    // Description should indicate it has a value
    expect(dbNode?.description).toBe('2 items (has value)');
  });

  it('handles overlapping secret keys', () => {
    const overlappingEntries = [
      { key: 'App/Secret', value: 'secret-value', isSecret: true },
      { key: 'App/Secret/Key', value: 'key-value', isSecret: false },
    ];
    const tree = buildKeyHierarchy(overlappingEntries);

    const secretNode = tree[0].children.find((child) => child.label === 'Secret');

    expect(secretNode?.isValue).toBe(true);
    expect(secretNode?.isSecret).toBe(true);
    expect(secretNode?.children).toHaveLength(1);
    expect(secretNode?.description).toBe('1 item (has value)');
  });
});
