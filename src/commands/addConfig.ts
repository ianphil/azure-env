import type { QuickPickItem } from 'vscode';

export interface AddConfigFlowDeps {
  showInputBox: (options: {
    prompt: string;
    placeHolder?: string;
    value?: string;
  }) => Promise<string | undefined>;
  showQuickPickSingle: <T extends QuickPickItem>(
    items: T[],
    options?: { placeHolder?: string }
  ) => Promise<T | undefined>;
  getExistingPrefixes: () => Promise<string[]>;
  createSetting: (key: string, value: string, label?: string) => Promise<void>;
  refresh: () => Promise<void>;
  getLabel: () => string;
}

export type AddConfigResult =
  | { success: true; key: string }
  | { success: false; reason: 'cancelled' };

interface LabelItem extends QuickPickItem {
  value: string;
}

const LABEL_PLACEHOLDER = 'Select label for new setting';

export async function runAddConfigFlow(deps: AddConfigFlowDeps): Promise<AddConfigResult> {
  const prefixes = await deps.getExistingPrefixes();
  const prefixHint = prefixes.length > 0 ? `Existing prefixes: ${prefixes.slice(0, 3).join(', ')}` : undefined;

  const key = await deps.showInputBox({
    prompt: 'Configuration key',
    placeHolder: prefixHint,
  });

  if (key === undefined) {
    return { success: false, reason: 'cancelled' };
  }

  const value = await deps.showInputBox({
    prompt: `Value for "${key}"`,
  });

  if (value === undefined) {
    return { success: false, reason: 'cancelled' };
  }

  const configuredLabel = deps.getLabel();
  const labelItems: LabelItem[] = [
    {
      label: configuredLabel || '(no label)',
      value: configuredLabel,
    },
  ];

  const selectedLabel = await deps.showQuickPickSingle(labelItems, {
    placeHolder: LABEL_PLACEHOLDER,
  });

  if (!selectedLabel) {
    return { success: false, reason: 'cancelled' };
  }

  await deps.createSetting(key, value, selectedLabel.value);
  await deps.refresh();

  return { success: true, key };
}
