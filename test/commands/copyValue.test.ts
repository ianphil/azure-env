import { describe, it, expect, vi } from 'vitest';
import { copyValueCommand } from '../../src/commands/copyValue';

describe('copyValueCommand', () => {
  it('copies value to clipboard and shows confirmation', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const showInformationMessage = vi.fn().mockResolvedValue(undefined);

    await copyValueCommand({ value: 'secret-value', label: 'API_KEY' }, {
      writeText,
      showInformationMessage,
    });

    expect(writeText).toHaveBeenCalledWith('secret-value');
    expect(showInformationMessage).toHaveBeenCalledWith('Value copied to clipboard');
  });
});
