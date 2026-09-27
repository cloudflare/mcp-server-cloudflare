# Cloudflare Audit Logs MCP Server 🕵🏻

## Deprecated

This dedicated MCP server is deprecated. Use the Cloudflare API MCP server at [`mcp.cloudflare.com/mcp`](https://mcp.cloudflare.com/mcp) instead. It covers the Audit Logs v2 API, including filters and cursor pagination through `GET /accounts/{account_id}/logs/audit`.

The Audit Logs API itself is not deprecated. Only this dedicated MCP server is being retired.

Configure the replacement server in your MCP client:

```json
{
	"mcpServers": {
		"cloudflare-api": {
			"url": "https://mcp.cloudflare.com/mcp"
		}
	}
}
```

The replacement uses [Code Mode](https://blog.cloudflare.com/code-mode-mcp/). Its `search` and `execute` tools cover the full Cloudflare API and return the complete Audit Logs API response. Clients that need endpoint-specific tools can use `https://mcp.cloudflare.com/mcp?codemode=false`; Audit Logs is exposed as `get_accounts_logs_audit`. See [`cloudflare/mcp`](https://github.com/cloudflare/mcp) for details.

The tool below still works for now, but no new features will be added. Please migrate to the Cloudflare API MCP server.

---

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

Audit logs summarize the history of changes made within your Cloudflare account. Audit logs include account level actions like zone configuration changes. The tool is powered by the [Audit Log API](https://developers.cloudflare.com/api/resources/accounts/subresources/logs/subresources/audit/methods/list/).

The `/mcp` and `/sse` URLs use the same stateless SDK v2 handler and create a fresh server with request-scoped auth/account context for every request. `/sse` is not the deprecated HTTP+SSE transport. OAuth grants and token validation remain durable security state; the server stores no MCP protocol session.

## 🔨 Available Tools

Currently available tools:

| **Category**   | **Tool**                  | **Description**                                                                                  |
| -------------- | ------------------------- | ------------------------------------------------------------------------------------------------ |
| **Audit Logs** | `auditlogs_by_account_id` | Fetches the history of changes between within your Cloudflare account over a specific time range |

**Note:** This tool is account-scoped. Single-account credentials and account-scoped API tokens are detected automatically. If your credentials can access multiple accounts, pass `account_id` to the tool or set a `cf-account-id` request header in your MCP client configuration.

### Prompt Examples

- `Were there any suspicious changes made to my Cloudflare account yesterday around lunch time?`
- `When was the last activity that updated a DNS record?`

## Connect to the MCP server

> This connection information is retained for existing users. New users should configure [`mcp.cloudflare.com/mcp`](https://mcp.cloudflare.com/mcp) as shown above.

Connect your MCP client directly to `https://auditlogs.mcp.cloudflare.com/mcp`. If prompted, complete the Cloudflare OAuth flow in your browser. The tools become available after authorization.

Bug fixes are still accepted. See [CONTRIBUTING.md](CONTRIBUTING.md) for local setup. New features should be proposed in the unified [`cloudflare/mcp`](https://github.com/cloudflare/mcp) repository.
