export interface RevealValueItem {
  value?: string;
}

export interface RevealValueDeps {
  showWarningMessage: (
    message: string,
    options: { modal: true },
    confirmLabel: string
  ) => Promise<string | undefined>;
  showInformationMessage: (message: string) => void | Promise<void>;
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
  await deps.showInformationMessage(value);
}
