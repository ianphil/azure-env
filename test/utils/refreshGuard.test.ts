import { describe, it, expect, beforeEach } from 'vitest';
import { RefreshGuard } from '../../src/utils/refreshGuard';

describe('RefreshGuard', () => {
  let guard: RefreshGuard;

  beforeEach(() => {
    guard = new RefreshGuard();
  });

  describe('tryStart', () => {
    it('returns true on first call', () => {
      expect(guard.tryStart()).toBe(true);
    });

    it('returns false when already in progress', () => {
      guard.tryStart();
      expect(guard.tryStart()).toBe(false);
    });
  });

  describe('finish', () => {
    it('allows new refresh after finish', () => {
      guard.tryStart();
      guard.finish();
      expect(guard.tryStart()).toBe(true);
    });

    it('is safe to call when not in progress', () => {
      // Should not throw
      guard.finish();
      expect(guard.isRefreshing).toBe(false);
    });
  });

  describe('isRefreshing', () => {
    it('is false initially', () => {
      expect(guard.isRefreshing).toBe(false);
    });

    it('is true after tryStart', () => {
      guard.tryStart();
      expect(guard.isRefreshing).toBe(true);
    });

    it('is false after finish', () => {
      guard.tryStart();
      guard.finish();
      expect(guard.isRefreshing).toBe(false);
    });
  });

  describe('withGuard', () => {
    it('executes function when not in progress', async () => {
      const result = await guard.withGuard(async () => 'success');
      expect(result).toEqual({ executed: true, result: 'success' });
    });

    it('returns executed: false when blocked', async () => {
      guard.tryStart();
      const result = await guard.withGuard(async () => 'success');
      expect(result).toEqual({ executed: false });
    });

    it('releases lock after function completes', async () => {
      await guard.withGuard(async () => 'done');
      expect(guard.isRefreshing).toBe(false);
    });

    it('releases lock even if function throws', async () => {
      try {
        await guard.withGuard(async () => {
          throw new Error('test error');
        });
      } catch {
        // Expected
      }
      expect(guard.isRefreshing).toBe(false);
    });

    it('propagates errors from function', async () => {
      await expect(
        guard.withGuard(async () => {
          throw new Error('test error');
        })
      ).rejects.toThrow('test error');
    });
  });

  describe('concurrent access', () => {
    it('blocks concurrent refreshes', async () => {
      const results: string[] = [];

      // Start first refresh
      const first = guard.withGuard(async () => {
        results.push('first-start');
        await new Promise((resolve) => setTimeout(resolve, 50));
        results.push('first-end');
        return 'first';
      });

      // Try to start second refresh immediately
      const second = guard.withGuard(async () => {
        results.push('second');
        return 'second';
      });

      const [firstResult, secondResult] = await Promise.all([first, second]);

      expect(firstResult).toEqual({ executed: true, result: 'first' });
      expect(secondResult).toEqual({ executed: false });
      expect(results).toEqual(['first-start', 'first-end']);
    });
  });
});
