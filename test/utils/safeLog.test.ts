import { describe, it, expect, vi, beforeEach } from 'vitest';
import { sanitizeForLogging, safeStringify, SafeLogger } from '../../src/utils/safeLog';
import { AppConfigError } from '../../src/errors';

describe('sanitizeForLogging', () => {
  it('returns primitives unchanged', () => {
    expect(sanitizeForLogging(null)).toBe(null);
    expect(sanitizeForLogging(undefined)).toBe(undefined);
    expect(sanitizeForLogging(42)).toBe(42);
    expect(sanitizeForLogging(true)).toBe(true);
    expect(sanitizeForLogging('hello')).toBe('hello');
  });

  it('redacts password fields', () => {
    const obj = { username: 'admin', password: 'secret123' };
    const result = sanitizeForLogging(obj) as Record<string, unknown>;
    expect(result.username).toBe('admin');
    expect(result.password).toBe('[REDACTED]');
  });

  it('redacts secret fields', () => {
    const obj = { name: 'config', secret: 'mysecret' };
    const result = sanitizeForLogging(obj) as Record<string, unknown>;
    expect(result.name).toBe('config');
    expect(result.secret).toBe('[REDACTED]');
  });

  it('redacts key fields', () => {
    const obj = { id: '123', apiKey: 'abc123' };
    const result = sanitizeForLogging(obj) as Record<string, unknown>;
    expect(result.id).toBe('123');
    expect(result.apiKey).toBe('[REDACTED]');
  });

  it('redacts token fields', () => {
    const obj = { accessToken: 'jwt...', refreshToken: 'refresh...' };
    const result = sanitizeForLogging(obj) as Record<string, unknown>;
    expect(result.accessToken).toBe('[REDACTED]');
    expect(result.refreshToken).toBe('[REDACTED]');
  });

  it('redacts connectionstring fields', () => {
    const obj = { connectionString: 'Server=tcp:...' };
    const result = sanitizeForLogging(obj) as Record<string, unknown>;
    expect(result.connectionString).toBe('[REDACTED]');
  });

  it('handles nested objects', () => {
    const obj = {
      config: {
        database: {
          host: 'localhost',
          password: 'dbpass',
        },
      },
    };
    const result = sanitizeForLogging(obj) as Record<string, unknown>;
    const config = result.config as Record<string, unknown>;
    const database = config.database as Record<string, unknown>;
    expect(database.host).toBe('localhost');
    expect(database.password).toBe('[REDACTED]');
  });

  it('handles arrays', () => {
    const arr = [{ key: 'value1' }, { name: 'safe' }];
    const result = sanitizeForLogging(arr) as Array<Record<string, unknown>>;
    expect(result[0].key).toBe('[REDACTED]');
    expect(result[1].name).toBe('safe');
  });

  it('handles mixed arrays', () => {
    const arr = [1, 'string', { secret: 'value' }];
    const result = sanitizeForLogging(arr) as Array<unknown>;
    expect(result[0]).toBe(1);
    expect(result[1]).toBe('string');
    expect((result[2] as Record<string, unknown>).secret).toBe('[REDACTED]');
  });

  it('is case-insensitive for field names', () => {
    const obj = { PASSWORD: 'upper', Secret: 'mixed', apikey: 'lower' };
    const result = sanitizeForLogging(obj) as Record<string, unknown>;
    expect(result.PASSWORD).toBe('[REDACTED]');
    expect(result.Secret).toBe('[REDACTED]');
    expect(result.apikey).toBe('[REDACTED]');
  });
});

describe('safeStringify', () => {
  it('returns JSON string with redacted values', () => {
    const obj = { name: 'test', password: 'secret' };
    const result = safeStringify(obj);
    expect(result).toContain('"name": "test"');
    expect(result).toContain('"password": "[REDACTED]"');
  });

  it('uses custom indentation', () => {
    const obj = { a: 1 };
    const result = safeStringify(obj, 4);
    expect(result).toContain('    ');
  });
});

describe('SafeLogger', () => {
  let mockChannel: {
    appendLine: ReturnType<typeof vi.fn>;
    show: ReturnType<typeof vi.fn>;
  };
  let logger: SafeLogger;

  beforeEach(() => {
    mockChannel = {
      appendLine: vi.fn(),
      show: vi.fn(),
    };
    logger = new SafeLogger(mockChannel as unknown as import('vscode').OutputChannel);
  });

  describe('log methods', () => {
    it('logs info messages', () => {
      logger.info('Test message');
      expect(mockChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[INFO] Test message'));
    });

    it('logs debug messages', () => {
      logger.debug('Debug message');
      expect(mockChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[DEBUG] Debug message'));
    });

    it('logs warn messages', () => {
      logger.warn('Warning message');
      expect(mockChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[WARN] Warning message'));
    });

    it('logs error messages', () => {
      logger.error('Error message');
      expect(mockChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('[ERROR] Error message'));
    });

    it('includes timestamp in log messages', () => {
      logger.info('Test');
      const call = mockChannel.appendLine.mock.calls[0][0];
      // ISO timestamp format: 2024-01-01T00:00:00.000Z
      expect(call).toMatch(/\[\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });
  });

  describe('data logging', () => {
    it('logs data with redacted sensitive fields', () => {
      logger.info('Config loaded', { endpoint: 'https://test.com', password: 'secret' });
      expect(mockChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('"endpoint": "https://test.com"'));
      expect(mockChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('"password": "[REDACTED]"'));
    });
  });

  describe('error logging', () => {
    it('logs Error objects with message and stack', () => {
      const error = new Error('Test error');
      logger.error('Operation failed', error);
      expect(mockChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('Message: Test error'));
      expect(mockChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('Stack:'));
    });

    it('logs typed error properties', () => {
      const error = new AppConfigError('Failed to get setting', 'MyApp/Config', 'dev');
      (error as unknown as { statusCode: number }).statusCode = 404;
      logger.error('Failed', error);
      expect(mockChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('code: APP_CONFIG_ERROR'));
      expect(mockChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('statusCode: 404'));
      expect(mockChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('key: MyApp/Config'));
    });

    it('logs non-Error objects safely', () => {
      logger.error('Failed', { password: 'secret', code: 'ERR_001' });
      expect(mockChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('"password": "[REDACTED]"'));
      expect(mockChannel.appendLine).toHaveBeenCalledWith(expect.stringContaining('"code": "ERR_001"'));
    });
  });

  describe('show', () => {
    it('shows the output channel', () => {
      logger.show();
      expect(mockChannel.show).toHaveBeenCalledWith(true);
    });

    it('can show without preserving focus', () => {
      logger.show(false);
      expect(mockChannel.show).toHaveBeenCalledWith(false);
    });
  });
});
