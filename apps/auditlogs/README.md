# Cloudflare Audit Logs MCP Server 🕵🏻

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

Audit logs summarize the history of changes made within your Cloudflare account. Audit logs include account level actions like zone configuration changes. The tool is powered by the [Audit Log API](https://developers.cloudflare.com/api/resources/accounts/subresources/logs/subresources/audit/methods/list/)

## 🔨 Available Tools

Currently available tools:

| **Category**   | **Tool**                  | **Description**                                                                                  |
| -------------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| **Audit Logs** | `auditlogs_by_account_id` | Fetches the history of changes between within your Cloudflare account over a specific time range |

### Prompt Examples

- `Were there any suspicious changes made to my Cloudflare account yesterday around lunch time?`
- `When was the last activity that updated a DNS record?`

## Access the remote MCP server from from any MCP Client

If your MCP client has first class support for remote MCP servers, the client will provide a way to accept the server URL (`https://auditlogs.mcp.cloudflare.com/sse`) directly within its interface (for example in[Cloudflare AI Playground](https://playground.ai.cloudflare.com/)).

If your client does not yet support remote MCP servers, you will need to set up its resepective configuration file using [mcp-remote](https://www.npmjs.com/package/mcp-remote) to specify which servers your client can access.

Replace the content with the following configuration:

```json
{
	"mcpServers": {
		"cloudflare": {
			"command": "npx",
			"args": ["mcp-remote", "https://auditlogs.mcp.cloudflare.com/sse"]
		}
	}
}
```

Once you've set up your configuration file, restart MCP client and a browser window will open showing your OAuth login page. Proceed through the authentication flow to grant the client access to your MCP server. After you grant access, the tools will become available for you to use.
