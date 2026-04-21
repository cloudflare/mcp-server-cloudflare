# Cloudflare Identity Management MCP Server 🔐

A [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that enables external customers to manage Cloudflare identity and access through natural language prompts.

## Features

This MCP server provides tools for managing:

- **API Tokens**: Create, update, delete, roll, and verify API tokens
- **Account Members**: Add, remove, and manage account member access
- **Roles**: View available roles and their permissions

## 🔨 Available Tools

### API Token Management

| Tool                         | Description                                       |
| ---------------------------- | ------------------------------------------------- |
| `api_token_list`             | List all API tokens for the authenticated user    |
| `api_token_get`              | Get detailed information about a specific token   |
| `api_token_create`           | Create a new API token with specified permissions |
| `api_token_update`           | Update an existing token's settings               |
| `api_token_delete`           | Delete an API token permanently                   |
| `api_token_roll`             | Rotate a token's secret value                     |
| `api_token_verify`           | Verify the current token's validity               |
| `api_permission_groups_list` | List available permission groups                  |

### Account Member Management

| Tool                    | Description                             |
| ----------------------- | --------------------------------------- |
| `account_members_list`  | List all members of an account          |
| `account_member_get`    | Get detailed information about a member |
| `account_member_add`    | Invite a new member to the account      |
| `account_member_update` | Update a member's roles or status       |
| `account_member_remove` | Remove a member from the account        |

### Role Management

| Tool                 | Description                                    |
| -------------------- | ---------------------------------------------- |
| `account_roles_list` | List all available roles for the account       |
| `account_role_get`   | Get detailed information about a specific role |

## Access the MCP Server

### From MCP Clients

If your MCP client supports remote MCP servers, use this URL:

```
https://iam.mcp.cloudflare.com/mcp
```

### Using mcp-remote

For clients that don't support remote servers natively:

```json
{
	"mcpServers": {
		"cloudflare-identity": {
			"command": "npx",
			"args": ["mcp-remote", "https://iam.mcp.cloudflare.com/mcp"]
		}
	}
}
```

## Prompt Examples

- "Show me all my API tokens"
- "Create a new token with DNS edit permissions for zone example.com"
- "When does my current token expire?"
- "Who has access to my account?"
- "Invite user@example.com as an Administrator"
- "Remove john@example.com from the account"
- "What roles are available in my account?"
- "What permissions does the Administrator role have?"

## Development

### Prerequisites

- Node.js 18+
- pnpm

### Setup

```bash
# Install dependencies
pnpm install

# Generate types
pnpm types

# Run tests
pnpm test

# Start development server
pnpm dev
```

### Environment Variables

Create a `.dev.vars` file for local development:

```
ENVIRONMENT=development
DEV_DISABLE_OAUTH=true
DEV_CLOUDFLARE_API_TOKEN=your_token_here
DEV_CLOUDFLARE_EMAIL=your_email@example.com
```

## Architecture

This server follows the simplified MCP server architecture (like `apps/auditlogs`):

- **Main App** (`iam.app.ts`): MCP Agent class with OAuth handling
- **Tools** (`tools/iam.tools.ts`): All tools, schemas, and API functions in one file

## File Structure

```
src/
├── iam.app.ts           # Main MCP Agent class
├── iam.context.ts       # Environment types
└── tools/
    └── iam.tools.ts     # All 13 tools, schemas, and API functions
```

## Contributing

Contributions are welcome! Please follow the existing code patterns and add tests for new functionality.

## License

Apache-2.0
