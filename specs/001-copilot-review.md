# Copilot PR Review - Fixes

Address feedback from Copilot review on PR #1.

## Fixes

### 1. Overly broad `/auth/i` pattern in safeLog.ts (line 14)

**Issue:** Pattern matches "authentication", "author", "authorize" unnecessarily.

**Fix:** Change `/auth/i` to `/^auth$/i` to match only the exact word "auth".

### 2. refreshGuard.finish() ordering in extension.ts (line 264)

**Issue:** If statusBar operations throw, guard remains locked indefinitely.

**Fix:** Move `refreshGuard.finish()` to be the first line in the finally block.

### 3. Unused variable `previousState` in extension.ts (line 177)

**Issue:** Dead code.

**Fix:** Remove the unused variable.

### 4. Header casing in rateLimitError.ts (line 54)

**Issue:** Plain object fallback should be case-insensitive.

**Fix:** The `Headers.get()` API is already case-insensitive per spec, so remove redundant checks. For plain object fallback, use case-insensitive key matching:

```typescript
} else {
  // Plain object headers - case-insensitive lookup
  const key = Object.keys(headers).find(k => k.toLowerCase() === 'retry-after');
  if (key) {
    retryAfter = headers[key];
  }
}
```

### 5. Unused import `RefreshResult` in refresh.test.ts (line 2)

**Issue:** Dead import.

**Fix:** Remove unused import.

### 6. Unused import `AzureEnvError` in errors.test.ts (line 13)

**Issue:** Dead import.

**Fix:** Remove unused import.

## Skipped

- SafeLogger hardcoded property list - intentional for safety
- Auto-refresh workspace trust check - unnecessary complexity
- vitest.config.ts URL handling - already works cross-platform
