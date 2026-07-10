# Cloudflare Blog MCP Server

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that provides tools for searching and reading the [Cloudflare Blog](https://blog.cloudflare.com).

## 🔨 Available Tools

| **Tool**       | **Description**                                                                                  |
| -------------- | ------------------------------------------------------------------------------------------------ |
| `search_posts` | Search the Cloudflare Blog using semantic search. Returns relevant posts with excerpts and URLs. |
| `list_posts`   | List blog posts in reverse chronological order, with optional tag filtering and pagination.      |
| `get_post`     | Get a single blog post by slug, including its full HTML content.                                 |
| `list_tags`    | List all tags used on the Cloudflare Blog.                                                       |

### Prompt Examples

- `Search the Cloudflare Blog for posts about Workers KV`
- `List the latest Cloudflare blog posts tagged "zero-trust"`
- `Get the full content of the blog post with slug "workers-python-support"`

## Access the remote MCP server from any MCP Client

If your MCP client has first class support for remote MCP servers, you can connect directly using the server URL:

```json
{
	"mcpServers": {
		"cloudflare-blog": {
			"url": "https://blog.mcp.cloudflare.com/mcp"
		}
	}
}
```

This server requires no authentication — it provides read-only access to public Cloudflare Blog content.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](../../CONTRIBUTING.md) to get started.
