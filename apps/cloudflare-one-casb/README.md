# Cloudflare One CASB MCP Server

This [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server provides tools for inspecting Cloudflare One CASB integrations, assets, and asset categories. It supports Cloudflare OAuth and API-token authentication.

The authenticated `/mcp` endpoint creates a fresh SDK v2 server and request-scoped auth/account context for every request. OAuth grants and token validation remain durable security state, but the server exposes no legacy HTTP+SSE route and stores no MCP protocol session.

## Available tools

- List integrations and inspect one by ID.
- List and search assets, including by integration or category.
- List asset categories and filter them by vendor or type.

These tools are account-scoped. Single-account credentials and account-scoped API tokens are detected automatically. If your credentials can access multiple accounts, pass `account_id` to the tool or set a `cf-account-id` request header in your MCP client configuration.

## Connect

Use the production endpoint directly in clients with remote MCP support:

```json
{
	"mcpServers": {
		"cloudflare-casb": {
			"url": "https://casb.mcp.cloudflare.com/mcp"
		}
	}
}
```

To run the server locally, set `CLOUDFLARE_CLIENT_ID` and `CLOUDFLARE_CLIENT_SECRET`, configure the `OAUTH_KV` namespace in `wrangler.jsonc`, then run `pnpm dev`.
