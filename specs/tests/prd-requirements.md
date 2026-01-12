---
target:
  - src/extension.ts
---

# PRD Requirements

## Terminal Environment Injection

### Injects Variables Into All Terminals

Developers expect environment variables to be available in every terminal they open, not just specific ones. If variables only inject into certain terminals, developers will waste time debugging why their app works in one terminal but not another.

```
Given the extension.ts file
When the extension sets up environment injection
Then it uses VS Code's EnvironmentVariableCollection API
And the collection applies to all integrated terminals (not scoped to specific shells)
```
