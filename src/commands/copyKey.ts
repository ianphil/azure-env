export interface CopyKeyItem {
  fullKey?: string;
  label?: string;
}

export interface CopyKeyDeps {
  writeText: (value: string) => Promise<void>;
  showInformationMessage: (message: string) => void | Promise<void>;
}

const COPY_KEY_MESSAGE = 'Key name copied to clipboard';

export async function copyKeyCommand(
  item: CopyKeyItem | undefined,
  deps: CopyKeyDeps
): Promise<void> {
  if (!item) {
    return;
  }

  const key = item.fullKey ?? item.label ?? '';
  await deps.writeText(key);
  await deps.showInformationMessage(COPY_KEY_MESSAGE);
}
