# Cloudflare One CASB MCP Server 🔒

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It integrates tools powered by the [Cloudflare One CASB API](https://developers.cloudflare.com/cloudflare-one/applications/scan-apps/) to
identify security misconfigurations across your SaaS application integrations.

## 🔨 Available Tools

Currently available tools:

| **Category**            | **Tool**                                | **Description**                                 |
| ----------------------- | --------------------------------------- | ----------------------------------------------- |
| **Integrations**        | `integrations_list`                     | List all Cloudflare One integrations             |
|                         | `integration_by_id`                     | Analyze a specific integration by ID             |
| **Assets**              | `assets_list`                           | Paginated list of assets                         |
|                         | `assets_search`                         | Search assets by keyword                         |
|                         | `asset_by_id`                           | Get a specific asset by ID                       |
|                         | `assets_by_integration_id`              | List assets for a specific integration           |
|                         | `assets_by_category_id`                 | List assets for a specific category              |
| **Asset Categories**    | `asset_categories_list`                 | List all asset categories                        |
|                         | `asset_categories_by_vendor`            | List asset categories by vendor                  |
|                         | `asset_categories_by_type`              | Search asset categories by type                  |
|                         | `asset_categories_by_vendor_and_type`   | Search asset categories by vendor and type       |

This MCP server is still a work in progress, and we plan to add more tools in the future.

### Prompt Examples

- `List all my CASB integrations.`
- `Are there any security findings for my Google Workspace integration?`
- `Show me all assets for integration <id>.`
- `What asset categories are available for Microsoft?`

## Access the remote MCP server from any MCP Client

If your MCP client has first class support for remote MCP servers, the client will provide a way to accept the server URL (`https://casb.mcp.cloudflare.com`) directly within its interface (for example in [Cloudflare AI Playground](https://playground.ai.cloudflare.com/)).

If your client does not yet support remote MCP servers, you will need to set up its respective configuration file using [mcp-remote](https://www.npmjs.com/package/mcp-remote) to specify which servers your client can access.

Replace the content with the following configuration:

```json
{
	"mcpServers": {
		"cloudflare": {
			"command": "npx",
			"args": ["mcp-remote", "https://casb.mcp.cloudflare.com/mcp"]
		}
	}
}
```

Once you've set up your configuration file, restart MCP client and a browser window will open showing your OAuth login page. Proceed through the authentication flow to grant the client access to your MCP server. After you grant access, the tools will become available for you to use.

Interested in contributing, and running this server locally? See the [CONTRIBUTING.md](../../CONTRIBUTING.md) in the repo root to get started.
