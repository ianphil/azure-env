import { vi } from 'vitest';

// Mock VS Code namespace
export const workspace = {
  getConfiguration: vi.fn(() => ({
    get: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
  })),
};

export const window = {
  showQuickPick: vi.fn(),
  showInputBox: vi.fn(),
  showInformationMessage: vi.fn(),
  showWarningMessage: vi.fn(),
  showErrorMessage: vi.fn(),
  createOutputChannel: vi.fn(() => ({
    appendLine: vi.fn(),
    dispose: vi.fn(),
  })),
};

export const commands = {
  registerCommand: vi.fn(),
};

export enum ConfigurationTarget {
  Global = 1,
  Workspace = 2,
  WorkspaceFolder = 3,
}

export class Uri {
  static parse(value: string): Uri {
    return new Uri(value);
  }
  static file(path: string): Uri {
    return new Uri(`file://${path}`);
  }
  constructor(public readonly fsPath: string) {}
}

export class Disposable {
  static from(...disposables: { dispose(): unknown }[]): Disposable {
    return new Disposable(() => {
      disposables.forEach((d) => d.dispose());
    });
  }
  constructor(private readonly callOnDispose: () => void) {}
  dispose(): void {
    this.callOnDispose();
  }
}

// Mock EnvironmentVariableCollection
export const mockEnvironmentVariableCollection = {
  persistent: true,
  description: undefined,
  replace: vi.fn(),
  append: vi.fn(),
  prepend: vi.fn(),
  get: vi.fn(),
  forEach: vi.fn(),
  delete: vi.fn(),
  clear: vi.fn(),
  getScoped: vi.fn(),
  [Symbol.iterator]: vi.fn(),
};

// Mock ExtensionContext
export const mockExtensionContext = {
  subscriptions: [] as { dispose(): void }[],
  extensionPath: '/mock/extension/path',
  extensionUri: Uri.file('/mock/extension/path'),
  globalState: {
    get: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    keys: vi.fn().mockReturnValue([]),
  },
  workspaceState: {
    get: vi.fn(),
    update: vi.fn().mockResolvedValue(undefined),
    keys: vi.fn().mockReturnValue([]),
  },
  secrets: {
    get: vi.fn(),
    store: vi.fn().mockResolvedValue(undefined),
    delete: vi.fn().mockResolvedValue(undefined),
  },
  environmentVariableCollection: mockEnvironmentVariableCollection,
  storageUri: Uri.file('/mock/storage'),
  globalStorageUri: Uri.file('/mock/global-storage'),
  logUri: Uri.file('/mock/logs'),
  extensionMode: 1,
};
