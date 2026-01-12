/**
 * Guard to prevent concurrent refresh operations.
 * Uses a simple flag pattern to prevent race conditions when
 * multiple refresh commands are triggered simultaneously.
 */
export class RefreshGuard {
  private inProgress = false;

  /**
   * Attempt to start a refresh operation.
   * @returns true if the refresh can proceed, false if one is already in progress
   */
  tryStart(): boolean {
    if (this.inProgress) {
      return false;
    }
    this.inProgress = true;
    return true;
  }

  /**
   * Mark the refresh operation as complete.
   * Must be called when refresh finishes (success or failure).
   */
  finish(): void {
    this.inProgress = false;
  }

  /**
   * Check if a refresh is currently in progress.
   */
  get isRefreshing(): boolean {
    return this.inProgress;
  }

  /**
   * Execute a function with the refresh guard.
   * Automatically handles tryStart and finish.
   *
   * @param fn The async function to execute
   * @returns The result of fn, or undefined if refresh was blocked
   */
  async withGuard<T>(fn: () => Promise<T>): Promise<{ executed: true; result: T } | { executed: false }> {
    if (!this.tryStart()) {
      return { executed: false };
    }
    try {
      const result = await fn();
      return { executed: true, result };
    } finally {
      this.finish();
    }
  }
}
