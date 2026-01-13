export interface RevealValueItem {
  value?: string;
  fullKey?: string;
}

export interface RevealValueDeps {
  showWarningMessage: (
    message: string,
    options: { modal: true },
    confirmLabel: string
  ) => Thenable<string | undefined>;
  showInputBox: (options: {
    value: string;
    prompt: string;
    ignoreFocusOut?: boolean;
  }) => Thenable<string | undefined>;
}

const REVEAL_CONFIRM_LABEL = 'Reveal';
const REVEAL_WARNING_MESSAGE = 'Reveal secret value?';

export async function revealValueCommand(
  item: RevealValueItem | undefined,
  deps: RevealValueDeps
): Promise<void> {
  if (!item) {
    return;
  }

  const confirmation = await deps.showWarningMessage(
    REVEAL_WARNING_MESSAGE,
    { modal: true },
    REVEAL_CONFIRM_LABEL
  );

  if (confirmation !== REVEAL_CONFIRM_LABEL) {
    return;
  }

  const value = item.value ?? '';
  const keyName = item.fullKey ?? 'secret';
  await deps.showInputBox({
    value,
    prompt: `Secret value for "${keyName}" (read-only)`,
    ignoreFocusOut: false,
  });
}
