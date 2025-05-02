# Cloudflare Browser Rendering MCP Server 📡

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It integrates tools powered by the [Cloudflare Browser Rendering API](https://developers.cloudflare.com/browser-rendering/) to provide global
Internet traffic insights, trends and other utilities.

## 🔨 Available Tools

Currently available tools:

| **Tool**               | **Description**                                                              |
| ---------------------- | ---------------------------------------------------------------------------- |
| `get_url_html_content` | Retrieves the HTML content of the specified URL.                             |
| `get_url_markdown`     | Fetches the webpage content and converts it into Markdown format.            |
| `get_url_screenshot`   | Captures a screenshot of the webpage. Optionally, specify the viewport size. |

**Note:** To use these tools, ensure you have an active account set. If not, use `accounts_list` to list your accounts and `set_active_account` to set one as active.

This MCP server is still a work in progress, and we plan to add more tools in the future.

### Prompt Examples

- `Get the HTML content of https://example.com.`
- `Convert https://example.com to Markdown.`
- `Take a screenshot of https://example.com.`

## Access the remote MCP server from any MCP Client

If your MCP client has first class support for remote MCP servers, the client will provide a way to accept the server URL (`https://browser.mcp.cloudflare.com`) directly within its interface (for example in[Cloudflare AI Playground](https://playground.ai.cloudflare.com/)).

If your client does not yet support remote MCP servers, you will need to set up its resepective configuration file using mcp-remote (https://www.npmjs.com/package/mcp-remote) to specify which servers your client can access.

Replace the content with the following configuration:

```json
{
	"mcpServers": {
		"cloudflare": {
			"command": "npx",
			"args": ["mcp-remote", "https://browser.mcp.cloudflare.com/sse"]
		}
	}
}
```

Once you've set up your configuration file, restart MCP client and a browser window will open showing your OAuth login page. Proceed through the authentication flow to grant the client access to your MCP server. After you grant access, the tools will become available for you to use.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
