# Cloudflare AutoRAG MCP Server 📡

## ⚠️ Deprecated

**This server is deprecated.** AutoRAG has been superseded by [Cloudflare AI Search](https://developers.cloudflare.com/ai-search/), and the unified Cloudflare MCP server at [`mcp.cloudflare.com/mcp`](https://mcp.cloudflare.com/mcp) already covers AI Search (along with the rest of the Cloudflare API).

All new work should move to the unified server:

```json
{
	"mcpServers": {
		"cloudflare-api": {
			"url": "https://mcp.cloudflare.com/mcp"
		}
	}
}
```

That server uses [Code Mode](https://blog.cloudflare.com/code-mode-mcp/) — two generic tools (`search` and `execute`) that give agents access to the full Cloudflare API through code execution. It supports both OAuth (connect to the URL and authorize) and Cloudflare API tokens (send as a bearer token). See [`cloudflare/mcp`](https://github.com/cloudflare/mcp) for details.

### What about my existing AutoRAG instances?

- **Existing AutoRAG instances have been migrated to AI Search.** They remain reachable via both the legacy AutoRAG endpoints and the new AI Search endpoints — the underlying instance is the same, just exposed through both APIs.
- Because your instances are already available through AI Search, they are accessible through the unified [`mcp.cloudflare.com/mcp`](https://mcp.cloudflare.com/mcp) server (which covers AI Search) without any data migration on your part.
- The **AutoRAG REST API endpoints are no longer recommended** for new work. Refer to [Migrate from AutoRAG REST API](https://developers.cloudflare.com/ai-search/api/migration/rest-api/) for moving client code to AI Search.
- This MCP server continues to respond for now, but will be retired.

The tools below still function. Please migrate at your earliest convenience.

---

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It integrates tools powered by the [Cloudflare AutoRAG API](https://developers.cloudflare.com/autorag/) to allow you to access and query your account's AutoRAG instances.

The `/mcp` and `/sse` URLs use the same stateless SDK v2 handler and create a fresh server with request-scoped auth/account context for every request. `/sse` is not the deprecated HTTP+SSE transport. OAuth grants and token validation remain durable security state; the server stores no MCP protocol session.

## 🔨 Available Tools

Currently available tools:

| **Tool**    | **Description**                                                                  |
| ----------- | -------------------------------------------------------------------------------- |
| `list_rags` | Lists AutoRAGs with pagination support                                           |
| `search`    | Searches documents in a specified AutoRAG using a query (URL, title, or snippet) |
| `ai_search` | Performs AI-powered search on documents in a specified AutoRAG                   |

**Note:** These tools are account-scoped. Single-account credentials and account-scoped API tokens are detected automatically. If your credentials can access multiple accounts, pass `account_id` to the tool or set a `cf-account-id` request header in your MCP client configuration.

### Prompt Examples

- `List all AutoRAGs in my account.`
- `Search for documents in AutoRAG with ID 'rag123' using the query 'cloudflare security'.`
- `Perform an AI search in AutoRAG with ID 'rag456' for 'best practices for vector stores'.`

## Connect to the MCP server

> The following setup documentation is retained for existing users. New users should follow the migration path to [`mcp.cloudflare.com/mcp`](https://mcp.cloudflare.com/mcp) documented above.

Connect your MCP client directly to `https://autorag.mcp.cloudflare.com/mcp`. If prompted, complete the Cloudflare OAuth flow in your browser. The tools become available after authorization.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
