import { describe, it, expect, vi } from 'vitest';
import { copyKeyCommand } from '../../src/commands/copyKey';

describe('copyKeyCommand', () => {
  it('copies key name to clipboard and shows confirmation', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const showInformationMessage = vi.fn().mockResolvedValue(undefined);

    await copyKeyCommand({ fullKey: 'App/Database/Host' }, {
      writeText,
      showInformationMessage,
    });

    expect(writeText).toHaveBeenCalledWith('App/Database/Host');
    expect(showInformationMessage).toHaveBeenCalledWith('Key name copied to clipboard');
  });

  it('returns early when item is undefined', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const showInformationMessage = vi.fn().mockResolvedValue(undefined);

    await copyKeyCommand(undefined, {
      writeText,
      showInformationMessage,
    });

    expect(writeText).not.toHaveBeenCalled();
    expect(showInformationMessage).not.toHaveBeenCalled();
  });

  it('shows warning when fullKey is empty', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const showInformationMessage = vi.fn().mockResolvedValue(undefined);
    const showWarningMessage = vi.fn().mockResolvedValue(undefined);

    await copyKeyCommand({ fullKey: '' }, {
      writeText,
      showInformationMessage,
      showWarningMessage,
    });

    expect(writeText).not.toHaveBeenCalled();
    expect(showWarningMessage).toHaveBeenCalledWith('No key name available to copy');
  });

  it('shows warning when fullKey is undefined', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const showInformationMessage = vi.fn().mockResolvedValue(undefined);
    const showWarningMessage = vi.fn().mockResolvedValue(undefined);

    await copyKeyCommand({ fullKey: undefined }, {
      writeText,
      showInformationMessage,
      showWarningMessage,
    });

    expect(writeText).not.toHaveBeenCalled();
    expect(showWarningMessage).toHaveBeenCalledWith('No key name available to copy');
  });
});
