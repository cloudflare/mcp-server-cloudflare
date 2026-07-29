# Cloudflare AI Gateway MCP Server 📡

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It integrates tools powered by the [Cloudflare AI Gateway API](https://developers.cloudflare.com/ai-gateway/) to search
your AI Gateway logs, inspect prompts and responses, and get details about gateway usage.

The `/mcp` and `/sse` URLs use the same stateless SDK v2 handler and create a fresh server with request-scoped auth/account context for every request. `/sse` is not the deprecated HTTP+SSE transport. OAuth grants and token validation remain durable security state; the server stores no MCP protocol session.

## 🔨 Available Tools

Currently available tools:

| **Tool**                | **Description**                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `list_gateways`         | Lists all AI Gateways associated with the account, supporting pagination for easy navigation.                                       |
| `list_logs`             | Retrieves logs for a specified gateway, offering filters such as date ranges, feedback scores, success status, model, and provider. |
| `get_log_details`       | Fetches detailed information about a specific log identified by its log ID within a gateway.                                        |
| `get_log_request_body`  | Retrieves the request body associated with a specific log in a gateway.                                                             |
| `get_log_response_body` | Retrieves the response body associated with a specific log in a gateway.                                                            |

**Note:** These tools are account-scoped. Single-account credentials (and account-scoped API tokens) are detected automatically. If your credentials can access multiple accounts, pass `account_id` to the tool, or set a `cf-account-id` request header in your MCP client config.

This MCP server is still a work in progress, and we plan to add more tools in the future.

### Prompt Examples

- `List all my AI Gateways.`
- `Show logs for gateway 'gateway-001' between January 1, 2023, and January 31, 2023.`
- `Fetch the latest errors from gateway-001 and debug what might have happened wrongly`

## Connect to the MCP server

Connect your MCP client directly to `https://ai-gateway.mcp.cloudflare.com/mcp`. If prompted, complete the Cloudflare OAuth flow in your browser. The tools become available after authorization.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
