import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runAddConfigFlow, AddConfigFlowDeps } from '../../src/commands/addConfig';

describe('runAddConfigFlow', () => {
  let mockShowInputBox: ReturnType<typeof vi.fn>;
  let mockShowQuickPickSingle: ReturnType<typeof vi.fn>;
  let mockGetExistingPrefixes: ReturnType<typeof vi.fn>;
  let mockCreateSetting: ReturnType<typeof vi.fn>;
  let mockRefresh: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    mockShowInputBox = vi.fn();
    mockShowQuickPickSingle = vi.fn();
    mockGetExistingPrefixes = vi.fn().mockResolvedValue([]);
    mockCreateSetting = vi.fn();
    mockRefresh = vi.fn();
  });

  function createDeps(overrides: Partial<AddConfigFlowDeps> = {}): AddConfigFlowDeps {
    return {
      showInputBox: mockShowInputBox,
      showQuickPickSingle: mockShowQuickPickSingle,
      getExistingPrefixes: mockGetExistingPrefixes,
      createSetting: mockCreateSetting,
      refresh: mockRefresh,
      getLabel: () => 'dev',
      ...overrides,
    };
  }

  it('creates setting and refreshes environment', async () => {
    mockGetExistingPrefixes.mockResolvedValue(['App/', 'Service/']);
    mockShowInputBox
      .mockResolvedValueOnce('App/NewKey') // key name
      .mockResolvedValueOnce('my-value'); // value
    mockShowQuickPickSingle.mockResolvedValue({ label: 'dev', value: 'dev' });
    mockCreateSetting.mockResolvedValue(undefined);

    const result = await runAddConfigFlow(createDeps());

    expect(result).toEqual({ success: true, key: 'App/NewKey' });
    expect(mockCreateSetting).toHaveBeenCalledWith('App/NewKey', 'my-value', 'dev');
    expect(mockRefresh).toHaveBeenCalled();
  });

  describe('cancellation', () => {
    it('returns cancelled when user cancels key input', async () => {
      mockShowInputBox.mockResolvedValueOnce(undefined);

      const result = await runAddConfigFlow(createDeps());

      expect(result).toEqual({ success: false, reason: 'cancelled' });
      expect(mockCreateSetting).not.toHaveBeenCalled();
    });

    it('returns cancelled when user cancels value input', async () => {
      mockShowInputBox.mockResolvedValueOnce('App/Key').mockResolvedValueOnce(undefined);

      const result = await runAddConfigFlow(createDeps());

      expect(result).toEqual({ success: false, reason: 'cancelled' });
      expect(mockCreateSetting).not.toHaveBeenCalled();
    });

    it('returns cancelled when user cancels label selection', async () => {
      mockShowInputBox.mockResolvedValueOnce('App/Key').mockResolvedValueOnce('value');
      mockShowQuickPickSingle.mockResolvedValue(undefined);

      const result = await runAddConfigFlow(createDeps());

      expect(result).toEqual({ success: false, reason: 'cancelled' });
      expect(mockCreateSetting).not.toHaveBeenCalled();
    });
  });
});
