import { describe, it, expect } from 'vitest';
import { EnvTreeItem } from '../../src/models/envTreeItem';
import { TreeItemCollapsibleState, ThemeIcon } from '../__mocks__/vscode';

describe('EnvTreeItem', () => {
  describe('constructor', () => {
    it('creates tree item with key, value, and isSecret', () => {
      const item = new EnvTreeItem('DATABASE_URL', 'postgres://localhost', false);

      expect(item.label).toBe('DATABASE_URL');
      expect(item.value).toBe('postgres://localhost');
      expect(item.isSecret).toBe(false);
    });

    it('sets collapsibleState to None for leaf items', () => {
      const item = new EnvTreeItem('API_KEY', 'secret123', true);

      expect(item.collapsibleState).toBe(TreeItemCollapsibleState.None);
    });
  });

  describe('value display', () => {
    it('masks value display for secrets', () => {
      const item = new EnvTreeItem('API_KEY', 'secret123', true);

      expect(item.description).toBe('••••••••');
    });

    it('shows actual value for non-secrets', () => {
      const item = new EnvTreeItem('APP_NAME', 'my-app', false);

      expect(item.description).toBe('my-app');
    });

    it('truncates long values in description', () => {
      const longValue = 'a'.repeat(100);
      const item = new EnvTreeItem('LONG_VALUE', longValue, false);

      expect(item.description?.length).toBeLessThanOrEqual(50);
      expect(item.description).toContain('...');
    });
  });

  describe('contextValue', () => {
    it('sets contextValue to "secret" for secrets', () => {
      const item = new EnvTreeItem('API_KEY', 'secret123', true);

      expect(item.contextValue).toBe('secret');
    });

    it('sets contextValue to "configValue" for non-secrets', () => {
      const item = new EnvTreeItem('APP_NAME', 'my-app', false);

      expect(item.contextValue).toBe('configValue');
    });
  });

  describe('icons', () => {
    it('uses key icon for secrets', () => {
      const item = new EnvTreeItem('API_KEY', 'secret123', true);

      expect(item.iconPath).toBeInstanceOf(ThemeIcon);
      expect((item.iconPath as ThemeIcon).id).toBe('key');
    });

    it('uses symbol-constant icon for plain values', () => {
      const item = new EnvTreeItem('APP_NAME', 'my-app', false);

      expect(item.iconPath).toBeInstanceOf(ThemeIcon);
      expect((item.iconPath as ThemeIcon).id).toBe('symbol-constant');
    });
  });

  describe('tooltip', () => {
    it('shows full key name in tooltip', () => {
      const item = new EnvTreeItem('DATABASE_URL', 'postgres://localhost', false);

      expect(item.tooltip).toContain('DATABASE_URL');
    });

    it('indicates secret status in tooltip', () => {
      const secretItem = new EnvTreeItem('API_KEY', 'secret123', true);
      const plainItem = new EnvTreeItem('APP_NAME', 'my-app', false);

      expect(secretItem.tooltip).toContain('Secret');
      expect(plainItem.tooltip).not.toContain('Secret');
    });
  });
});
