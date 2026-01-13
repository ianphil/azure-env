import { describe, it, expect, vi } from 'vitest';
import { copyValueCommand } from '../../src/commands/copyValue';

describe('copyValueCommand', () => {
  it('copies value to clipboard and shows confirmation', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const showInformationMessage = vi.fn().mockResolvedValue(undefined);

    await copyValueCommand({ value: 'secret-value' }, {
      writeText,
      showInformationMessage,
    });

    expect(writeText).toHaveBeenCalledWith('secret-value');
    expect(showInformationMessage).toHaveBeenCalledWith('Value copied to clipboard');
  });

  it('returns early when item is undefined', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const showInformationMessage = vi.fn().mockResolvedValue(undefined);

    await copyValueCommand(undefined, {
      writeText,
      showInformationMessage,
    });

    expect(writeText).not.toHaveBeenCalled();
    expect(showInformationMessage).not.toHaveBeenCalled();
  });

  it('shows warning when value is empty', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const showInformationMessage = vi.fn().mockResolvedValue(undefined);
    const showWarningMessage = vi.fn().mockResolvedValue(undefined);

    await copyValueCommand({ value: '' }, {
      writeText,
      showInformationMessage,
      showWarningMessage,
    });

    expect(writeText).not.toHaveBeenCalled();
    expect(showWarningMessage).toHaveBeenCalledWith('No value available to copy');
  });

  it('shows warning when value is undefined', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const showInformationMessage = vi.fn().mockResolvedValue(undefined);
    const showWarningMessage = vi.fn().mockResolvedValue(undefined);

    await copyValueCommand({ value: undefined }, {
      writeText,
      showInformationMessage,
      showWarningMessage,
    });

    expect(writeText).not.toHaveBeenCalled();
    expect(showWarningMessage).toHaveBeenCalledWith('No value available to copy');
  });
});
