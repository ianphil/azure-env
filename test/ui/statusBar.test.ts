import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { StatusBarManager, ConnectionState } from '../../src/ui/statusBar';
import * as vscode from 'vscode';

// Get the mock functions from the vscode mock
const mockCreateStatusBarItem = vscode.window.createStatusBarItem as ReturnType<typeof vi.fn>;

describe('StatusBarManager', () => {
  let statusBarManager: StatusBarManager;
  let mockStatusBarItem: {
    text: string;
    tooltip: string;
    command: string;
    backgroundColor: unknown;
    show: ReturnType<typeof vi.fn>;
    hide: ReturnType<typeof vi.fn>;
    dispose: ReturnType<typeof vi.fn>;
  };

  beforeEach(() => {
    mockStatusBarItem = {
      text: '',
      tooltip: '',
      command: '',
      backgroundColor: undefined,
      show: vi.fn(),
      hide: vi.fn(),
      dispose: vi.fn(),
    };
    mockCreateStatusBarItem.mockReturnValue(mockStatusBarItem);
    statusBarManager = new StatusBarManager();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('initialization', () => {
    it('creates a status bar item', () => {
      expect(mockCreateStatusBarItem).toHaveBeenCalledWith(
        vscode.StatusBarAlignment.Left,
        100
      );
    });

    it('shows the status bar item', () => {
      expect(mockStatusBarItem.show).toHaveBeenCalled();
    });

    it('sets initial state to disconnected', () => {
      expect(statusBarManager.getState()).toBe('disconnected');
    });

    it('sets initial command to connect', () => {
      expect(mockStatusBarItem.command).toBe('azureEnv.connect');
    });
  });

  describe('setState', () => {
    const states: ConnectionState[] = [
      'disconnected',
      'connecting',
      'connected',
      'error',
      'refreshing',
    ];

    it.each(states)('updates state to %s', (state) => {
      statusBarManager.setState(state);
      expect(statusBarManager.getState()).toBe(state);
    });

    it('includes detail in connected state', () => {
      statusBarManager.setState('connected', 'myconfig');
      expect(mockStatusBarItem.text).toContain('myconfig');
    });

    it('shows variable count in detail', () => {
      statusBarManager.setState('connected', '5 vars');
      expect(mockStatusBarItem.text).toContain('5 vars');
    });
  });

  describe('display text', () => {
    it('shows cloud icon when disconnected', () => {
      statusBarManager.setState('disconnected');
      expect(mockStatusBarItem.text).toContain('$(cloud)');
    });

    it('shows spin icon when connecting', () => {
      statusBarManager.setState('connecting');
      expect(mockStatusBarItem.text).toContain('$(sync~spin)');
    });

    it('shows upload icon when connected', () => {
      statusBarManager.setState('connected');
      expect(mockStatusBarItem.text).toContain('$(cloud-upload)');
    });

    it('shows offline icon when error', () => {
      statusBarManager.setState('error');
      expect(mockStatusBarItem.text).toContain('$(cloud-offline)');
    });

    it('shows spin icon when refreshing', () => {
      statusBarManager.setState('refreshing');
      expect(mockStatusBarItem.text).toContain('$(sync~spin)');
    });
  });

  describe('tooltip', () => {
    it('prompts to connect when disconnected', () => {
      statusBarManager.setState('disconnected');
      expect(mockStatusBarItem.tooltip).toContain('connect');
    });

    it('shows authenticating when connecting', () => {
      statusBarManager.setState('connecting');
      expect(mockStatusBarItem.tooltip).toContain('Authenticating');
    });

    it('shows refresh prompt when connected', () => {
      statusBarManager.setState('connected');
      expect(mockStatusBarItem.tooltip).toContain('refresh');
    });

    it('shows reconnect prompt when error', () => {
      statusBarManager.setState('error');
      expect(mockStatusBarItem.tooltip).toContain('reconnect');
    });
  });

  describe('command', () => {
    it('uses connect command when disconnected', () => {
      statusBarManager.setState('disconnected');
      expect(mockStatusBarItem.command).toBe('azureEnv.connect');
    });

    it('uses refresh command when connected', () => {
      statusBarManager.setState('connected');
      expect(mockStatusBarItem.command).toBe('azureEnv.refresh');
    });

    it('uses connect command when error', () => {
      statusBarManager.setState('error');
      expect(mockStatusBarItem.command).toBe('azureEnv.connect');
    });
  });

  describe('background color', () => {
    it('has error background when in error state', () => {
      statusBarManager.setState('error');
      expect(mockStatusBarItem.backgroundColor).toBeDefined();
    });

    it('has no background when connected', () => {
      statusBarManager.setState('connected');
      expect(mockStatusBarItem.backgroundColor).toBeUndefined();
    });
  });

  describe('dispose', () => {
    it('disposes the status bar item', () => {
      statusBarManager.dispose();
      expect(mockStatusBarItem.dispose).toHaveBeenCalled();
    });
  });
});
