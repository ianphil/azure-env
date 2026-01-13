export interface CopyKeyItem {
  fullKey?: string;
}

export interface CopyKeyDeps {
  writeText: (value: string) => Thenable<void>;
  showInformationMessage: (message: string) => Thenable<unknown>;
  showWarningMessage?: (message: string) => Thenable<unknown>;
}

const COPY_KEY_MESSAGE = 'Key name copied to clipboard';
const NO_KEY_MESSAGE = 'No key name available to copy';

export async function copyKeyCommand(
  item: CopyKeyItem | undefined,
  deps: CopyKeyDeps
): Promise<void> {
  if (!item) {
    return;
  }

  if (!item.fullKey) {
    await deps.showWarningMessage?.(NO_KEY_MESSAGE);
    return;
  }

  await deps.writeText(item.fullKey);
  await deps.showInformationMessage(COPY_KEY_MESSAGE);
}
