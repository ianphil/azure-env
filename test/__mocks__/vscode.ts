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
    show: vi.fn(),
  })),
  createStatusBarItem: vi.fn(() => ({
    text: '',
    tooltip: '',
    command: '',
    backgroundColor: undefined,
    show: vi.fn(),
    hide: vi.fn(),
    dispose: vi.fn(),
  })),
  withProgress: vi.fn(
    async <T>(
      _options: unknown,
      task: (
        progress: { report: (value: unknown) => void },
        token: { isCancellationRequested: boolean }
      ) => Promise<T>
    ): Promise<T> => {
      const progress = { report: vi.fn() };
      const token = { isCancellationRequested: false };
      return task(progress, token);
    }
  ),
};

export enum StatusBarAlignment {
  Left = 1,
  Right = 2,
}

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

export class CancellationTokenSource {
  token = {
    isCancellationRequested: false,
    onCancellationRequested: vi.fn(),
  };
  cancel = vi.fn();
  dispose = vi.fn();
}

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

export class ThemeColor {
  constructor(public readonly id: string) {}
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

// Tree View mocks
export enum TreeItemCollapsibleState {
  None = 0,
  Collapsed = 1,
  Expanded = 2,
}

export class TreeItem {
  label?: string;
  description?: string;
  tooltip?: string;
  iconPath?: ThemeIcon;
  contextValue?: string;
  collapsibleState?: TreeItemCollapsibleState;

  constructor(
    label: string,
    collapsibleState?: TreeItemCollapsibleState
  ) {
    this.label = label;
    this.collapsibleState = collapsibleState;
  }
}

export class ThemeIcon {
  static readonly File = new ThemeIcon('file');
  static readonly Folder = new ThemeIcon('folder');

  constructor(public readonly id: string) {}
}

export class EventEmitter<T> {
  private listeners: ((e: T) => void)[] = [];

  event = (listener: (e: T) => void): Disposable => {
    this.listeners.push(listener);
    return new Disposable(() => {
      const index = this.listeners.indexOf(listener);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    });
  };

  fire(data: T): void {
    this.listeners.forEach((listener) => listener(data));
  }

  dispose(): void {
    this.listeners = [];
  }
}

// Clipboard mock
export const env = {
  clipboard: {
    writeText: vi.fn().mockResolvedValue(undefined),
    readText: vi.fn().mockResolvedValue(''),
  },
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
