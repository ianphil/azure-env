import { describe, it, expect, vi } from 'vitest';
import { revealValueCommand } from '../../src/commands/revealValue';

describe('revealValueCommand', () => {
  it('shows value when user confirms', async () => {
    const showWarningMessage = vi.fn().mockResolvedValue('Reveal');
    const showInformationMessage = vi.fn().mockResolvedValue(undefined);

    await revealValueCommand({ value: 'super-secret' }, {
      showWarningMessage,
      showInformationMessage,
    });

    expect(showWarningMessage).toHaveBeenCalled();
    expect(showInformationMessage).toHaveBeenCalledWith('super-secret');
  });

  it('does nothing when user cancels', async () => {
    const showWarningMessage = vi.fn().mockResolvedValue(undefined);
    const showInformationMessage = vi.fn().mockResolvedValue(undefined);

    await revealValueCommand({ value: 'super-secret' }, {
      showWarningMessage,
      showInformationMessage,
    });

    expect(showInformationMessage).not.toHaveBeenCalled();
  });
});
