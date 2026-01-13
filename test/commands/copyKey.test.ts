import { describe, it, expect, vi } from 'vitest';
import { copyKeyCommand } from '../../src/commands/copyKey';

describe('copyKeyCommand', () => {
  it('copies key name to clipboard and shows confirmation', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    const showInformationMessage = vi.fn().mockResolvedValue(undefined);

    await copyKeyCommand({ fullKey: 'App/Database/Host', label: 'Host' }, {
      writeText,
      showInformationMessage,
    });

    expect(writeText).toHaveBeenCalledWith('App/Database/Host');
    expect(showInformationMessage).toHaveBeenCalledWith('Key name copied to clipboard');
  });
});
