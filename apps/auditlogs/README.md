# Cloudflare Audit Logs MCP Server 🕵🏻

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

Connect your MCP client directly to `https://auditlogs.mcp.cloudflare.com/mcp`. If prompted, complete the Cloudflare OAuth flow in your browser. The tools become available after authorization.
