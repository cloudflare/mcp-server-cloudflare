# Cloudflare Logpush MCP Server 📜

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It integrates tools powered by the [Cloudflare Logpush API](https://developers.cloudflare.com/logs/) to provide insights into Logpush jobs.

## 🔨 Available Tools

Currently available tools:

| **Category**                | **Tool**                     | **Description**                                                         |
| --------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| **Logpush Jobs By Account** | `logpush_jobs_by_account_id` | Fetches Logpush jobs by specific account or all accounts under the user |

This MCP server is still a work in progress, and we plan to add more tools in the future.

### Prompt Examples

- `Which Logpush jobs failed recently?`
- `Do any of my Logpush jobs in my <insert name> account have errors?`
- `Can you list all the enabled job failures from today?`

## Access the remote MCP server from from any MCP Client

If your MCP client has first class support for remote MCP servers, the client will provide a way to accept the server URL (`https://logs.mcp.cloudflare.com`) directly within its interface (for example in[Cloudflare AI Playground](https://playground.ai.cloudflare.com/)).

If your client does not yet support remote MCP servers, you will need to set up its resepective configuration file using [mcp-remote](https://www.npmjs.com/package/mcp-remote) to specify which servers your client can access.

Replace the content with the following configuration:

```json
{
	"mcpServers": {
		"cloudflare": {
			"command": "npx",
			"args": ["mcp-remote", "https://logs.mcp.cloudflare.com/sse"]
		}
	}
}
```

Once you've set up your configuration file, restart MCP client and a browser window will open showing your OAuth login page. Proceed through the authentication flow to grant the client access to your MCP server. After you grant access, the tools will become available for you to use.
