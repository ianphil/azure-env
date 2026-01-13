export interface CopyValueItem {
  value?: string;
}

export interface CopyValueDeps {
  writeText: (value: string) => Thenable<void>;
  showInformationMessage: (message: string) => Thenable<unknown>;
  showWarningMessage?: (message: string) => Thenable<unknown>;
}

const COPY_VALUE_MESSAGE = 'Value copied to clipboard';
const NO_VALUE_MESSAGE = 'No value available to copy';

export async function copyValueCommand(
  item: CopyValueItem | undefined,
  deps: CopyValueDeps
): Promise<void> {
  if (!item) {
    return;
  }

  if (!item.value) {
    await deps.showWarningMessage?.(NO_VALUE_MESSAGE);
    return;
  }

  await deps.writeText(item.value);
  await deps.showInformationMessage(COPY_VALUE_MESSAGE);
}
