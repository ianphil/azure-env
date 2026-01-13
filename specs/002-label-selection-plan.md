# Plan: Add Label Selection to Connect Flow

## Overview
Add a label selection step to the connect flow so users can choose which label (e.g., `dev`, `prod`) to use. Currently, the connect flow saves endpoint, selectedKeys, subscriptionId, and tenantId - but not the label, causing refresh to fail when keys have labels.

## Current State
- `AzureEnvSettings` already has a `label` field defined
- `appConfigService.listSettings()` already accepts `labelFilter`
- `refreshEnvironment()` already uses `settings.label`
- **Gap:** `runConnectFlow()` doesn't prompt for label or save it

## Implementation Plan (TDD Red/Green)

### Step 1: RED - Write Failing Tests for listLabels

**File:** `test/services/appConfigService.test.ts`

Add tests for a new `listLabels()` method:
```typescript
describe('listLabels', () => {
  it('should return unique labels from settings', async () => {
    // Mock settings with labels: 'dev', 'prod', 'dev', null
    // Expect: ['dev', 'prod', ''] (unique, sorted)
  });

  it('should return empty array when no settings exist', async () => {
    // Expect: []
  });
});
```

### Step 2: GREEN - Implement listLabels

**File:** `src/services/appConfigService.ts`

```typescript
async listLabels(): Promise<string[]> {
  const settings = await this.listSettings({});
  const labels = new Set<string>();
  for (const setting of settings) {
    labels.add(setting.label ?? '');
  }
  return Array.from(labels).sort();
}
```

### Step 3: RED - Write Failing Tests for Connect Flow Label Selection

**File:** `test/commands/connect.test.ts`

Add new dependency `listLabels` to `ConnectFlowDeps` and tests:

```typescript
describe('label selection', () => {
  it('should prompt for label when multiple labels exist', async () => {
    // Setup: listLabels returns ['dev', 'prod']
    // Expect: showQuickPickSingle called for label selection
    // Expect: saveSettings includes selected label
  });

  it('should auto-select when only one label exists', async () => {
    // Setup: listLabels returns ['dev']
    // Expect: NO prompt for label
    // Expect: saveSettings includes 'dev' as label
  });

  it('should use empty string when no labels exist', async () => {
    // Setup: listLabels returns ['']
    // Expect: NO prompt
    // Expect: saveSettings includes '' as label
  });

  it('should filter keys by selected label', async () => {
    // Setup: select label 'dev'
    // Expect: listKeys called with label filter
  });

  it('should handle label selection cancellation', async () => {
    // Setup: user cancels label picker
    // Expect: { success: false, reason: 'cancelled' }
  });
});
```

### Step 4: GREEN - Update Connect Flow

**File:** `src/commands/connect.ts`

1. Add to `ConnectFlowDeps`:
```typescript
listLabels: (endpoint: string, credential: unknown) => Promise<string[]>;
```

2. Add label selection step after store selection, before key listing:
```typescript
// Step 4: Get and select label
const labels = await listLabels(selectedStore.endpoint, selectedSub.subscription);

let selectedLabel = '';
if (labels.length > 1 || (labels.length === 1 && labels[0] !== '')) {
  const labelItems = labels.map(l => ({
    label: l || '(no label)',
    value: l,
  }));

  const pickedLabel = await showQuickPickSingle(labelItems, {
    placeHolder: 'Select configuration label',
  });

  if (!pickedLabel) {
    return { success: false, reason: 'cancelled' };
  }
  selectedLabel = pickedLabel.value;
}

// Step 5: List keys filtered by label
const keys = await listKeys(selectedStore.endpoint, selectedSub.subscription, selectedLabel);
```

3. Update `saveSettings` call to include label:
```typescript
await saveSettings({
  endpoint: selectedStore.endpoint,
  selectedKeys: selectedKeys.map((k) => k.key),
  subscriptionId: selectedSub.subscription.subscriptionId,
  tenantId: selectedSub.subscription.tenantId,
  label: selectedLabel,
});
```

### Step 5: Update listKeys Signature

**File:** `src/commands/connect.ts`

Update `ConnectFlowDeps.listKeys` to accept label:
```typescript
listKeys: (endpoint: string, subscription: unknown, label: string) => Promise<KeyInfo[]>;
```

**File:** `src/extension.ts`

Update `listConfigKeys` to filter by label:
```typescript
async function listConfigKeys(
  endpoint: string,
  subscription: unknown,
  label: string
): Promise<KeyInfo[]> {
  const credential = new ScopedCredential(sub);
  const appConfigService = new AppConfigService(endpoint, credential);
  const settings = await appConfigService.listSettings({ labelFilter: label || undefined });
  return settings.filter((s) => s.key).map((s) => ({ key: s.key! }));
}
```

### Step 6: Update Extension Integration

**File:** `src/extension.ts`

Add `listLabels` wrapper and wire into connect command:
```typescript
async function listConfigLabels(endpoint: string, subscription: unknown): Promise<string[]> {
  const credential = new ScopedCredential(sub);
  const appConfigService = new AppConfigService(endpoint, credential);
  return appConfigService.listLabels();
}
```

## Files to Modify

| File | Changes |
|------|---------|
| `src/services/appConfigService.ts` | Add `listLabels()` method |
| `test/services/appConfigService.test.ts` | Add tests for `listLabels()` |
| `src/commands/connect.ts` | Add label selection step, update deps interface |
| `test/commands/connect.test.ts` | Add label selection tests |
| `src/extension.ts` | Wire up `listLabels`, update `listConfigKeys` signature |

## Verification

1. **Run tests:** `npm test` - all tests should pass
2. **Manual test:**
   - Create App Config with keys having different labels (dev, prod)
   - Run "Azure Env: Connect to App Configuration"
   - Verify label picker appears after store selection
   - Select a label and verify only keys with that label are shown
   - Complete setup and verify `.vscode/settings.json` includes the label
   - Run "Azure Env: Refresh Environment" and verify it works
