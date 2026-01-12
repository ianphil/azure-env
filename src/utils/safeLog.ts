import type { OutputChannel } from 'vscode';

/**
 * Patterns that indicate a field may contain sensitive data.
 */
const SECRET_PATTERNS = [
  /password/i,
  /secret/i,
  /key/i,
  /token/i,
  /credential/i,
  /connectionstring/i,
  /apikey/i,
  /auth/i,
  /bearer/i,
  /private/i,
];

const REDACT_PLACEHOLDER = '[REDACTED]';

/**
 * Check if a field name might contain sensitive data.
 */
function isSensitiveField(fieldName: string): boolean {
  return SECRET_PATTERNS.some((pattern) => pattern.test(fieldName));
}

/**
 * Recursively sanitize an object, redacting values of sensitive fields.
 */
export function sanitizeForLogging(obj: unknown): unknown {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (typeof obj === 'string') {
    // Don't redact plain strings - we don't know their context
    return obj;
  }

  if (typeof obj !== 'object') {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map(sanitizeForLogging);
  }

  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (isSensitiveField(key)) {
      sanitized[key] = REDACT_PLACEHOLDER;
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeForLogging(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

/**
 * Safely stringify an object for logging, redacting sensitive fields.
 */
export function safeStringify(obj: unknown, indent = 2): string {
  return JSON.stringify(sanitizeForLogging(obj), null, indent);
}

/**
 * Log level for SafeLogger.
 */
export type LogLevel = 'DEBUG' | 'INFO' | 'WARN' | 'ERROR';

/**
 * A logger that automatically redacts sensitive information.
 */
export class SafeLogger {
  constructor(private readonly channel: OutputChannel) {}

  /**
   * Log a debug message.
   */
  debug(message: string, data?: unknown): void {
    this.log('DEBUG', message, data);
  }

  /**
   * Log an info message.
   */
  info(message: string, data?: unknown): void {
    this.log('INFO', message, data);
  }

  /**
   * Log a warning message.
   */
  warn(message: string, data?: unknown): void {
    this.log('WARN', message, data);
  }

  /**
   * Log an error message.
   */
  error(message: string, error?: unknown): void {
    this.log('ERROR', message);
    if (error instanceof Error) {
      this.channel.appendLine(`  Message: ${error.message}`);
      if (error.stack) {
        this.channel.appendLine(`  Stack: ${error.stack}`);
      }
      // Log additional properties if they exist (like our typed errors)
      const errorWithProps = error as unknown as Record<string, unknown>;
      const propsToLog = ['code', 'statusCode', 'key', 'secretUri', 'field'];
      for (const prop of propsToLog) {
        if (prop in errorWithProps && errorWithProps[prop] !== undefined) {
          this.channel.appendLine(`  ${prop}: ${errorWithProps[prop]}`);
        }
      }
    } else if (error !== undefined) {
      this.channel.appendLine(`  ${safeStringify(error)}`);
    }
  }

  private log(level: LogLevel, message: string, data?: unknown): void {
    const timestamp = new Date().toISOString();
    this.channel.appendLine(`[${timestamp}] [${level}] ${message}`);
    if (data !== undefined) {
      this.channel.appendLine(`  ${safeStringify(data)}`);
    }
  }

  /**
   * Show the output channel.
   */
  show(preserveFocus = true): void {
    this.channel.show(preserveFocus);
  }
}
