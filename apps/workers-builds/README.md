# Workers Builds MCP Server 🔭

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It integrates tools to provide insights and management capabilities for your Cloudflare Workers Builds.

## 🔨 Available Tools

Currently available tools:

| **Category**       | **Tool**                           | **Description**                                                                          |
| ------------------ | ---------------------------------- | ---------------------------------------------------------------------------------------- |
| **Workers Builds** | `workers_builds_set_active_worker` | Sets the active Worker ID for subsequent calls.                                          |
| **Workers Builds** | `workers_builds_list_builds`       | Lists builds for a Cloudflare Worker.                                                    |
| **Workers Builds** | `workers_builds_get_build`         | Retrieves details for a specific build by its UUID, including build and deploy commands. |
| **Workers Builds** | `workers_builds_get_build_logs`    | Fetches the logs for a Cloudflare Workers build by its UUID.                             |

This MCP server is still a work in progress, and we plan to add more tools in the future.

### Prompt Examples

- `Set my-worker as the active worker.`
- `List the last 5 builds for my worker 'my-ci-worker'.`
- `What were the details for build 'xxxx-xxxx-xxxx-xxxx'?`
- `Show me the logs for build my latest build.`
- `Did the latest build for worker frontend-app succeed?`

## Access the remote MCP server from from any MCP Client

If your MCP client has first class support for remote MCP servers, the client will provide a way to accept the server URL (`https://builds.mcp.cloudflare.com`) directly within its interface (for example in [Cloudflare AI Playground](https://playground.ai.cloudflare.com/)).

If your client does not yet support remote MCP servers, you will need to set up its resepective configuration file using [mcp-remote](https://www.npmjs.com/package/mcp-remote) to specify which servers your client can access.

Replace the content with the following configuration:

```json
{
	"mcpServers": {
		"cloudflare": {
			"command": "npx",
			"args": ["mcp-remote@latest", "https://builds.mcp.cloudflare.com/sse"]
		}
	}
}
```

Once you've set up your configuration file, restart MCP client and a browser window will open showing your OAuth login page. Proceed through the authentication flow to grant the client access to your MCP server. After you grant access, the tools will become available for you to use.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
