import { describe, it, expect } from 'vitest';

describe('Test Infrastructure', () => {
  it('vitest is configured correctly', () => {
    expect(true).toBe(true);
  });

  it('can import vscode mock', async () => {
    const vscode = await import('vscode');
    expect(vscode.workspace).toBeDefined();
    expect(vscode.window).toBeDefined();
    expect(vscode.ConfigurationTarget).toBeDefined();
  });
});
