# Cloudflare Container Sandbox MCP Server

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP connections, with Cloudflare OAuth built-in.

It integrates tools for running a sandbox container with your MCP client. With this server you can allow your LLM to run arbitrary code, such as Node or Python, in a secure, sandboxed environment.

## Tools

| **Category**            | **Tool**                | **Description**                                                                                                                       |
| ----------------------- | ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| **Container Lifecycle** | `container_initialize`  | (Re)start a container. Containers are intended to be ephemeral and don't save any state. Containers are only guaranteed to last ~10m. |
|                         | `container_ping`        | Ping a container for connectivity                                                                                                     |
| **Filesystem**          | `container_file_write`  | Write to a file                                                                                                                       |
|                         | `container_files_list`  | List all files in the work directory                                                                                                  |
|                         | `container_file_read`   | Read the contents of a single file or directory                                                                                       |
|                         | `container_file_delete` | Delete a single file or directory                                                                                                     |
| **Execution**           | `container_exec`        | Run a command in the shell                                                                                                            |

This MCP server is still a work in progress, and we plan to add more tools in the future.

### Prompt Examples

- `Create a visualization using matplotlib. Run it in the container that you can start`
- `Clone and explore this github repo: [repo link]. Setup and run the tests in your development environment`
- `Analyze this data using Python`

## Access the remote MCP server from any MCP Client

If your MCP client has first class support for remote MCP servers, the client will provide a way to accept the server URL (`https://bindings.mcp.cloudflare.com`) directly within its interface (for example in [Cloudflare AI Playground](https://playground.ai.cloudflare.com/)).

If your client does not yet support remote MCP servers, you will need to set up its respective configuration file using [mcp-remote](https://www.npmjs.com/package/mcp-remote) to specify which servers your client can access.

Replace the content with the following configuration:

```json
{
	"mcpServers": {
		"cloudflare": {
			"command": "npx",
			"args": ["mcp-remote", "https://containers.mcp.cloudflare.com/mcp"]
		}
	}
}
```

Once you've set up your configuration file, restart MCP client and a browser window will open showing your OAuth login page. Proceed through the authentication flow to grant the client access to your MCP server. After you grant access, the tools will become available for you to use.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
