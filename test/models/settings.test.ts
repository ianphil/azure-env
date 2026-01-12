import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as vscode from 'vscode';
import { getSettings, saveSettings } from '../../src/models/settings';

describe('getSettings', () => {
  beforeEach(() => {
    vi.mocked(vscode.workspace.getConfiguration).mockClear();
  });

  it('returns settings from workspace configuration', () => {
    const mockConfig = {
      get: vi.fn((key: string) => {
        const values: Record<string, unknown> = {
          endpoint: 'https://test.azconfig.io',
          selectedKeys: ['key1', 'key2'],
          label: 'dev',
          keyFilter: 'App/*',
        };
        return values[key];
      }),
    };
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

    const settings = getSettings();
    expect(settings.endpoint).toBe('https://test.azconfig.io');
    expect(settings.selectedKeys).toEqual(['key1', 'key2']);
    expect(settings.label).toBe('dev');
    expect(settings.keyFilter).toBe('App/*');
  });

  it('returns empty/default values when not configured', () => {
    const mockConfig = { get: vi.fn(() => undefined) };
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

    const settings = getSettings();
    expect(settings.endpoint).toBe('');
    expect(settings.selectedKeys).toEqual([]);
    expect(settings.label).toBe('');
    expect(settings.keyFilter).toBe('*');
  });
});

describe('saveSettings', () => {
  it('saves settings to workspace configuration', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockConfig = { update: mockUpdate };
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

    await saveSettings({
      endpoint: 'https://new.azconfig.io',
      selectedKeys: ['key1'],
      label: 'prod',
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      'endpoint',
      'https://new.azconfig.io',
      vscode.ConfigurationTarget.Workspace
    );
    expect(mockUpdate).toHaveBeenCalledWith(
      'selectedKeys',
      ['key1'],
      vscode.ConfigurationTarget.Workspace
    );
    expect(mockUpdate).toHaveBeenCalledWith('label', 'prod', vscode.ConfigurationTarget.Workspace);
  });

  it('only saves provided fields', async () => {
    const mockUpdate = vi.fn().mockResolvedValue(undefined);
    const mockConfig = { update: mockUpdate };
    vi.mocked(vscode.workspace.getConfiguration).mockReturnValue(mockConfig as any);

    await saveSettings({ endpoint: 'https://test.azconfig.io' });

    expect(mockUpdate).toHaveBeenCalledWith(
      'endpoint',
      'https://test.azconfig.io',
      vscode.ConfigurationTarget.Workspace
    );
    expect(mockUpdate).toHaveBeenCalledTimes(1);
  });
});
