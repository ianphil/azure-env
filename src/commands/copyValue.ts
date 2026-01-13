export interface CopyValueItem {
  value?: string;
  label?: string;
}

export interface CopyValueDeps {
  writeText: (value: string) => Promise<void>;
  showInformationMessage: (message: string) => void | Promise<void>;
}

const COPY_VALUE_MESSAGE = 'Value copied to clipboard';

export async function copyValueCommand(
  item: CopyValueItem | undefined,
  deps: CopyValueDeps
): Promise<void> {
  if (!item) {
    return;
  }

  const value = item.value ?? '';
  await deps.writeText(value);
  await deps.showInformationMessage(COPY_VALUE_MESSAGE);
}
