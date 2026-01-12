import * as vscode from 'vscode';

/**
 * Options for a progress task.
 */
export interface ProgressOptions {
  /** Title shown in the progress notification */
  title: string;
  /** Whether the operation can be cancelled */
  cancellable?: boolean;
  /** Where to show the progress (Notification by default) */
  location?: vscode.ProgressLocation;
}

/**
 * Progress reporter passed to the task function.
 */
export interface ProgressReporter {
  /** Report progress with optional message and increment */
  report(value: { message?: string; increment?: number }): void;
}

/**
 * Run an async task with a progress indicator.
 *
 * @param options Progress display options
 * @param task The async task to run
 * @returns The result of the task, or undefined if cancelled
 *
 * @example
 * ```typescript
 * const result = await withProgress(
 *   { title: 'Loading configuration...', cancellable: true },
 *   async (progress, token) => {
 *     for (const key of keys) {
 *       if (token.isCancellationRequested) {
 *         throw new Error('Operation cancelled');
 *       }
 *       progress.report({ message: `Fetching ${key}`, increment: 100 / keys.length });
 *       await fetchKey(key);
 *     }
 *     return keys.length;
 *   }
 * );
 * ```
 */
export async function withProgress<T>(
  options: ProgressOptions,
  task: (progress: ProgressReporter, token: vscode.CancellationToken) => Promise<T>
): Promise<T> {
  return vscode.window.withProgress(
    {
      location: options.location ?? vscode.ProgressLocation.Notification,
      title: options.title,
      cancellable: options.cancellable ?? false,
    },
    async (progress, token) => {
      return task(progress, token);
    }
  );
}

/**
 * Create a simple progress reporter that tracks completion percentage.
 */
export function createProgressTracker(
  totalSteps: number,
  progress: ProgressReporter
): { step: (message?: string) => void; complete: () => void } {
  let currentStep = 0;
  const incrementPerStep = totalSteps > 0 ? 100 / totalSteps : 100;

  return {
    step(message?: string): void {
      currentStep++;
      progress.report({
        message,
        increment: incrementPerStep,
      });
    },
    complete(): void {
      // Ensure we reach 100%
      const remaining = 100 - currentStep * incrementPerStep;
      if (remaining > 0) {
        progress.report({ increment: remaining });
      }
    },
  };
}
