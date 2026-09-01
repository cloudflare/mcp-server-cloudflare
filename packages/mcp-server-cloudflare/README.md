# `@cloudflare/mcp-server-cloudflare`

Local stdio MCP server for the Cloudflare API.

```json
{
	"mcpServers": {
		"cloudflare": {
			"command": "npx",
			"args": ["-y", "@cloudflare/mcp-server-cloudflare", "run", "YOUR_ACCOUNT_ID"],
			"env": {
				"CLOUDFLARE_API_TOKEN": "YOUR_API_TOKEN"
			}
		}
	}
}
```

This package retains the tools from version 0.2.0 and provides a compatibility layer for standards-compliant MCP tool results. New integrations should generally use Cloudflare's maintained remote MCP servers listed in the [repository README](https://github.com/cloudflare/mcp-server-cloudflare#readme).
