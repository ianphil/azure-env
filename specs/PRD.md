# Azure Environment - VS Code Extension PRD

## Overview

A VS Code extension that enables development teams to share environment variables and secrets through Azure App Configuration and Azure Key Vault. Developers connect to an App Configuration store, select the keys relevant to their project, and those values are automatically injected into VS Code's integrated terminal environment.

This extension is designed to complement the **Azure Tools extension pack** (`ms-vscode.vscode-node-azure-pack`), leveraging its authentication infrastructure and fitting into the Azure ecosystem that teams already use.

## Problem Statement

Development teams struggle to share environment configuration consistently:
- `.env` files get shared insecurely via Slack or email
- New team members spend hours tracking down required config values
- Secrets end up committed to repos or stored in plain text
- No audit trail of who accessed what configuration

## Solution

Leverage Azure's managed services (App Configuration + Key Vault) with Azure RBAC to provide secure, auditable, discoverable environment configuration that integrates seamlessly into the developer's local workflow.

## User Personas

**Primary: Developer on a team**
- Needs to get environment variables for local development
- Has Azure RBAC access granted by their team
- Uses VS Code as primary editor
- Already has Azure Tools extension pack installed for other Azure development

**Secondary: Tech Lead / Platform Engineer**
- Sets up the App Configuration store and Key Vault
- Grants RBAC permissions to team members
- Creates initial configuration values and secrets

## User Flows

### First Run - Connect to App Configuration

1. Developer opens a repository that has no Azure Env configuration
2. Developer runs command "Azure Env: Connect to App Configuration"
3. Extension uses Azure Account extension for authentication
4. Developer selects Azure subscription from quick pick
5. Developer selects App Configuration store from quick pick
6. Extension displays browsable tree of all keys in the store, organized by key prefix hierarchy
7. Developer filters and/or multi-selects the keys relevant to this project
8. Developer optionally sets a label filter (defaults to "dev")
9. Extension saves selection to workspace settings (`.vscode/settings.json`)
10. Extension resolves all values (including Key Vault references) and injects into terminal environment

### Returning Developer - Automatic Environment Injection

1. Developer opens a repository that has Azure Env configured in workspace settings
2. Extension activates and reads configuration from workspace settings
3. Extension authenticates via Azure Account extension
4. Extension resolves all configured keys from App Configuration
5. For any Key Vault references, extension resolves the actual secret values
6. Extension injects all resolved values into VS Code's environment variable collection
7. Any terminal opened has the environment variables available

### Create New Configuration Value

1. Developer runs command "Azure Env: Add Configuration Value"
2. Quick pick shows existing key prefixes for autocomplete
3. Developer enters key name
4. Developer enters value
5. Developer confirms label (uses configured label as default)
6. Extension writes to App Configuration
7. Extension refreshes local environment

### Create New Secret

1. Developer runs command "Azure Env: Add Secret"
2. Extension prompts for Key Vault selection (if no default configured) or uses default
3. Developer enters secret name
4. Developer enters secret value
5. Extension prompts: "Create App Configuration reference?" (Yes/No)
6. If yes: Developer enters App Config key name (defaults to secret name)
7. Extension creates secret in Key Vault
8. If reference requested: Extension creates Key Vault reference in App Configuration
9. Extension refreshes local environment

### Manual Refresh

1. Developer runs command "Azure Env: Refresh Environment"
2. Extension re-fetches all values from App Configuration and Key Vault
3. Extension updates environment variable collection
4. New terminals get fresh values; VS Code shows indicator on existing terminals

## Functional Requirements

### Azure Tools Extension Pack Integration
- SHOULD be designed to work alongside other Azure Tools extensions
- SHOULD contribute views to the existing Azure view container where appropriate
- MUST leverage VS Code's built-in Microsoft authentication provider
- SHOULD follow UX patterns established by other Azure extensions (tree views, quick picks, etc.)

### Authentication
> **Note:** The `ms-vscode.azure-account` extension was deprecated in January 2025. This extension uses VS Code's built-in Microsoft authentication provider via `@microsoft/vscode-azext-azureauth`.

- MUST integrate with VS Code's built-in Microsoft authentication provider
- MUST use `@microsoft/vscode-azext-azureauth` for Azure subscription and credential management
- MUST use `@azure/identity` for Azure SDK client authentication
- MUST NOT store any credentials or tokens directly
- SHOULD prompt user to sign in via VS Code's native Microsoft sign-in if not already authenticated

### App Configuration Integration
- MUST list available App Configuration stores in a subscription
- MUST browse keys hierarchically based on "/" delimiter convention
- MUST support key filter patterns (e.g., "MyService/*")
- MUST support label filtering
- MUST detect Key Vault references by content type
- MUST create new configuration settings
- MUST create Key Vault reference settings with correct content type

### Key Vault Integration
- MUST resolve Key Vault references to actual secret values
- MUST handle Key Vault references pointing to different vaults
- MUST create new secrets in Key Vault
- SHOULD support setting a default Key Vault for new secret creation

### Terminal Environment Injection
- MUST use VS Code's `EnvironmentVariableCollection` API
- MUST inject environment variables into all integrated terminals
- MUST persist environment across VS Code restarts (via collection persistence)
- MUST provide visual indicator that terminal environment is modified

### Configuration Storage
- MUST store configuration in workspace settings (`.vscode/settings.json`)
- MUST NOT store any secret values in settings
- Settings stored MUST be safe to commit to version control
- Configuration includes: endpoint, key filter, label, selected keys, default vault

### Tree View
- MUST display configured keys in a tree view
- MUST show current resolved values (masked for secrets)
- MUST distinguish between plain values and Key Vault references
- MUST allow revealing/copying values
- SHOULD provide context menu for common actions

## Non-Functional Requirements

### Performance
- SHOULD cache resolved values with configurable TTL
- SHOULD resolve Key Vault references in parallel
- MUST NOT block VS Code startup

### Security
- MUST rely entirely on Azure RBAC for access control
- MUST NOT cache secret values to disk (only in memory or VS Code SecretStorage)
- MUST handle authentication failures gracefully

### Error Handling
- MUST surface clear errors when authentication fails
- MUST surface clear errors when RBAC permissions are insufficient
- MUST handle partial failures (some keys resolve, others fail)
- SHOULD continue operating with cached values if Azure is unreachable

## Technical Design

### Extension Structure

```
azure-env/
├── package.json
├── tsconfig.json
├── src/
│   ├── extension.ts                 # Extension activation and deactivation
│   ├── services/
│   │   ├── authService.ts           # VS Code Microsoft auth integration
│   │   ├── appConfigService.ts      # App Configuration operations
│   │   └── keyVaultService.ts       # Key Vault operations
│   ├── providers/
│   │   ├── envTreeProvider.ts       # Tree view data provider
│   │   └── terminalEnvProvider.ts   # Environment injection logic
│   ├── commands/
│   │   ├── connect.ts               # First-run connection flow
│   │   ├── refresh.ts               # Manual refresh
│   │   ├── addConfig.ts             # Create configuration value
│   │   └── addSecret.ts             # Create secret
│   └── models/
│       ├── settings.ts              # Workspace settings interface
│       └── configValue.ts           # Resolved config value model
```

### Dependencies

```json
{
  "dependencies": {
    "@microsoft/vscode-azext-azureauth": "^5.1.1",
    "@microsoft/vscode-azext-utils": "^4.0.3",
    "@azure/identity": "^4.13.0",
    "@azure/app-configuration": "^1.10.0",
    "@azure/arm-appconfiguration": "^5.0.0",
    "@azure/keyvault-secrets": "^4.10.0"
  }
}
```

> **Note:** No `extensionDependencies` required - authentication is handled via VS Code's built-in Microsoft authentication provider.

### Relationship to Azure Tools Extension Pack

The Azure Tools extension pack (`ms-vscode.vscode-node-azure-pack`) includes:

| Extension | Relevance to Azure Env |
|-----------|------------------------|
| Azure Account | ~~Deprecated January 2025~~ - not used |
| Azure Resources | Reference for tree view patterns and UX conventions |
| Azure App Service | Code reference for Azure service integration patterns |
| Azure Functions | Code reference for Azure service integration patterns |
| Azure Storage | Not directly used |
| Azure Databases | Not directly used |

This extension does NOT require the Azure Tools pack or any extension dependencies. Authentication is handled via VS Code's built-in Microsoft authentication provider. However, the extension is designed to feel native alongside other Azure extensions for developers who have the pack installed.

### Workspace Settings Schema

```json
{
  "azureEnv.appConfiguration.endpoint": "https://myteam-config.azconfig.io",
  "azureEnv.appConfiguration.keyFilter": "MyService/*",
  "azureEnv.appConfiguration.label": "dev",
  "azureEnv.appConfiguration.selectedKeys": [
    "MyService/Database/*",
    "MyService/Redis/*"
  ],
  "azureEnv.keyVault.defaultVault": "https://myteam-vault.vault.azure.net"
}
```

### Key Vault Reference Detection

App Configuration stores Key Vault references with a specific content type:

```
application/vnd.microsoft.appconfig.keyvaultref+json;charset=utf-8
```

The value is JSON containing the secret URI:

```json
{
  "uri": "https://myvault.vault.azure.net/secrets/MySecret"
}
```

### Environment Variable Collection Usage

```typescript
const envCollection = context.environmentVariableCollection;
envCollection.clear();
for (const [key, value] of resolvedConfig) {
  envCollection.replace(key, value);
}
```

## Commands

| Command ID | Title | Description |
|------------|-------|-------------|
| `azureEnv.connect` | Azure Env: Connect to App Configuration | First-run flow to select store and keys |
| `azureEnv.refresh` | Azure Env: Refresh Environment | Re-fetch all values from Azure |
| `azureEnv.addConfig` | Azure Env: Add Configuration Value | Create a new plain config value |
| `azureEnv.addSecret` | Azure Env: Add Secret | Create a new Key Vault secret with optional App Config reference |
| `azureEnv.disconnect` | Azure Env: Disconnect | Clear configuration and environment |

## Views

### Tree View: Environment (view ID: `azureEnv.environment`)

Location: Azure view container (integrates with Azure Tools extensions)

Shows hierarchical view of configured keys:

```
▼ myteam-config.azconfig.io [dev]
  ▼ MyService
    ▼ Database
        ConnectionString         "Server=tcp:..."
      🔐 Password                ••••••••
    ▼ Redis
        Endpoint                 "myredis.redis..."
      🔐 AccessKey               ••••••••
```

Context menu items:
- Copy Value
- Copy Key Name
- Reveal Value (for secrets)
- Refresh

## Out of Scope for MVP

- Label switching UI (change label in settings manually)
- Multiple environment profiles
- Event Grid change notifications
- Key Vault secret rotation handling
- Bulk import/export
- Conflict resolution with existing environment variables
- Feature flags (App Configuration feature management)

## Success Metrics

- Time from "clone repo" to "working local environment" reduced by >50%
- Zero secrets stored in plain text files or chat logs
- Audit trail available for all configuration access via Azure logs

## Open Questions

1. Should the extension warn if a configured key no longer exists in App Configuration?
2. How should we handle environment variable naming? App Config keys often have "/" but env vars typically use "_". Transform or preserve?
3. Should there be a "dry run" mode that shows what would be injected without actually injecting?
