# Tree View Implementation Plan (TDD)

## Overview

Add a Tree View to display configured environment keys with hierarchy, secret masking, and context menu actions. Uses own Activity Bar icon (no Azure Tools dependency).

## TDD Cycles

### Cycle 1: VS Code Mock Extensions ✓
**File:** `test/__mocks__/vscode.ts`

Add mocks for:
- `TreeItemCollapsibleState` enum
- `TreeItem` class
- `ThemeIcon` class
- `EventEmitter` class
- `env.clipboard.writeText`

### Cycle 2: EnvTreeItem Model ✓
**Test:** `test/models/envTreeItem.test.ts`
**Impl:** `src/models/envTreeItem.ts`

Tests:
1. Creates tree item with key, value, isSecret
2. Masks value display for secrets (`••••••••`)
3. Shows actual value for non-secrets
4. Sets `contextValue` to "secret" or "configValue"
5. Uses `$(key)` icon for secrets, `$(symbol-constant)` for plain values

### Cycle 3: Key Hierarchy Parser
**Test:** `test/models/keyHierarchy.test.ts`
**Impl:** `src/models/keyHierarchy.ts`

Tests (RED):
1. Splits key by `/` delimiter
2. Handles key without delimiters
3. Builds hierarchical tree from flat keys
4. Folder nodes are Collapsed, leaf nodes are None
5. Folder nodes show child count in description

### Cycle 4: EnvTreeProvider Core
**Test:** `test/providers/envTreeProvider.test.ts`
**Impl:** `src/providers/envTreeProvider.ts`

Tests (RED):
1. Implements `getTreeItem` and `getChildren`
2. Returns empty array when no data
3. Populates tree after `setData()` called
4. Fires `onDidChangeTreeData` on update
5. Returns children for folder elements
6. `clear()` removes all data

### Cycle 5: Copy Commands
**Tests:** `test/commands/copyValue.test.ts`, `test/commands/copyKey.test.ts`
**Impl:** `src/commands/copyValue.ts`, `src/commands/copyKey.ts`

Tests (RED):
1. Copies value to clipboard
2. Shows confirmation message
3. Copies key name to clipboard

### Cycle 6: Reveal Value Command
**Test:** `test/commands/revealValue.test.ts`
**Impl:** `src/commands/revealValue.ts`

Tests (RED):
1. Shows warning confirmation dialog
2. Shows value when user confirms
3. Does nothing when user cancels

### Cycle 7: Refresh Integration
**Modify:** `test/commands/refresh.test.ts`, `src/commands/refresh.ts`

Tests (RED):
1. Refresh result includes items for tree view
2. Provider converts refresh data to tree items
3. Correctly identifies secrets by contentType

### Cycle 8: Context Management
**Add to:** `test/providers/envTreeProvider.test.ts`, `src/providers/envTreeProvider.ts`

Tests (RED):
1. Sets `azureEnv.configured` context to true when data set
2. Sets context to false on clear

### Cycle 9: Extension Wiring
**Modify:** `src/extension.ts`

Tests (RED):
1. Creates tree view on activation
2. Registers copyValue, copyKey, revealValue commands
3. Updates tree provider after successful refresh

### Cycle 10: Package.json
**Modify:** `package.json`

Add:
```json
{
  "viewsContainers": {
    "activitybar": [{
      "id": "azureEnv",
      "title": "Azure Env",
      "icon": "$(key)"
    }]
  },
  "views": {
    "azureEnv": [{
      "id": "azureEnv.environment",
      "name": "Environment",
      "when": "azureEnv.configured"
    }]
  },
  "commands": [
    { "command": "azureEnv.copyValue", "title": "Copy Value" },
    { "command": "azureEnv.copyKey", "title": "Copy Key Name" },
    { "command": "azureEnv.revealValue", "title": "Reveal Value" }
  ],
  "menus": {
    "view/item/context": [
      { "command": "azureEnv.copyValue", "when": "view == azureEnv.environment" },
      { "command": "azureEnv.copyKey", "when": "view == azureEnv.environment" },
      { "command": "azureEnv.revealValue", "when": "view == azureEnv.environment && viewItem == secret" }
    ]
  }
}
```

## Files to Create

| File | Purpose |
|------|---------|
| `src/models/envTreeItem.ts` | TreeItem model with secret detection |
| `src/models/keyHierarchy.ts` | Parse flat keys into tree structure |
| `src/providers/envTreeProvider.ts` | TreeDataProvider implementation |
| `src/commands/copyValue.ts` | Copy value command |
| `src/commands/copyKey.ts` | Copy key name command |
| `src/commands/revealValue.ts` | Reveal masked secret command |
| `test/models/envTreeItem.test.ts` | EnvTreeItem tests |
| `test/models/keyHierarchy.test.ts` | Key hierarchy tests |
| `test/providers/envTreeProvider.test.ts` | TreeProvider tests |
| `test/commands/copyValue.test.ts` | Copy value tests |
| `test/commands/copyKey.test.ts` | Copy key tests |
| `test/commands/revealValue.test.ts` | Reveal value tests |

## Files to Modify

| File | Changes |
|------|---------|
| `test/__mocks__/vscode.ts` | Add TreeItem, EventEmitter mocks |
| `src/commands/refresh.ts` | Return resolved items for tree view |
| `test/commands/refresh.test.ts` | Test items returned |
| `src/extension.ts` | Register tree view and commands |
| `package.json` | Add view container, views, menus |

## Verification

1. Run `npm test` - all tests pass
2. Press F5 to launch extension
3. Run "Azure Env: Connect" and select keys
4. Verify Activity Bar shows key icon
5. Click icon, verify tree shows hierarchical keys
6. Verify secrets show `********` and lock icon
7. Right-click item, test Copy Value/Key
8. Right-click secret, test Reveal Value
9. Run "Azure Env: Refresh", verify tree updates
