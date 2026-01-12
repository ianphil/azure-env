# Azure Env

A VS Code extension that injects environment variables from Azure App Configuration and Key Vault into your integrated terminal.

## Why Use This?

- **Stop sharing `.env` files** via Slack, email, or committing them to repos
- **Onboard faster** - new team members get working config in minutes, not hours
- **Secrets stay secure** - values live in Azure Key Vault with RBAC access control
- **Audit everything** - Azure logs who accessed what configuration

## User Setup

### Prerequisites

- VS Code with a Microsoft account signed in
- Azure RBAC access to your team's App Configuration store (and Key Vault for secrets)

### Getting Started

1. Install the extension
2. Run command: `Azure Env: Connect to App Configuration`
3. Select your Azure subscription and App Configuration store
4. Choose the keys relevant to your project
5. Open a new terminal - your environment variables are ready

Configuration is saved to `.vscode/settings.json` and is safe to commit.

### Commands

| Command | Description |
|---------|-------------|
| `Azure Env: Connect to App Configuration` | Initial setup - select store and keys |
| `Azure Env: Refresh Environment` | Re-fetch values from Azure |
| `Azure Env: Add Configuration Value` | Create a new config value |
| `Azure Env: Add Secret` | Create a Key Vault secret |
| `Azure Env: Disconnect` | Clear configuration |

## Development Setup

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build
npm run build

# Launch extension in debug mode
# Press F5 in VS Code (uses .vscode/launch.json)
```

### Project Structure

```
src/
├── extension.ts           # Activation entry point
├── commands/              # Command implementations
├── services/              # Azure service integrations
│   ├── authService.ts     # VS Code Microsoft auth
│   ├── appConfigService.ts
│   └── keyVaultService.ts
└── models/                # Types and utilities
```

### Running Tests

```bash
npm test              # Run all tests
npm run test:watch    # Watch mode
```
