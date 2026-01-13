import { describe, it, expect, vi } from 'vitest';
import { revealValueCommand } from '../../src/commands/revealValue';

describe('revealValueCommand', () => {
  it('shows value in input box when user confirms', async () => {
    const showWarningMessage = vi.fn().mockResolvedValue('Reveal');
    const showInputBox = vi.fn().mockResolvedValue(undefined);

    await revealValueCommand({ value: 'super-secret', fullKey: 'App/Password' }, {
      showWarningMessage,
      showInputBox,
    });

    expect(showWarningMessage).toHaveBeenCalled();
    expect(showInputBox).toHaveBeenCalledWith({
      value: 'super-secret',
      prompt: 'Secret value for "App/Password" (read-only)',
      ignoreFocusOut: false,
    });
  });

  it('uses default key name when fullKey is not provided', async () => {
    const showWarningMessage = vi.fn().mockResolvedValue('Reveal');
    const showInputBox = vi.fn().mockResolvedValue(undefined);

    await revealValueCommand({ value: 'super-secret' }, {
      showWarningMessage,
      showInputBox,
    });

    expect(showInputBox).toHaveBeenCalledWith({
      value: 'super-secret',
      prompt: 'Secret value for "secret" (read-only)',
      ignoreFocusOut: false,
    });
  });

  it('does nothing when user cancels', async () => {
    const showWarningMessage = vi.fn().mockResolvedValue(undefined);
    const showInputBox = vi.fn().mockResolvedValue(undefined);

    await revealValueCommand({ value: 'super-secret' }, {
      showWarningMessage,
      showInputBox,
    });

    expect(showInputBox).not.toHaveBeenCalled();
  });

  it('returns early when item is undefined', async () => {
    const showWarningMessage = vi.fn().mockResolvedValue('Reveal');
    const showInputBox = vi.fn().mockResolvedValue(undefined);

    await revealValueCommand(undefined, {
      showWarningMessage,
      showInputBox,
    });

    expect(showWarningMessage).not.toHaveBeenCalled();
    expect(showInputBox).not.toHaveBeenCalled();
  });
});
