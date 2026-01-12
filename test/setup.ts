import { vi, beforeEach } from 'vitest';

// Reset all mocks before each test
beforeEach(() => {
  vi.clearAllMocks();
});

// Global test utilities
export function createMockConfig(values: Record<string, unknown> = {}) {
  return {
    get: vi.fn((key: string, defaultValue?: unknown) => values[key] ?? defaultValue),
    update: vi.fn().mockResolvedValue(undefined),
    has: vi.fn((key: string) => key in values),
    inspect: vi.fn(),
  };
}
