# Cloudflare Container Sandbox MCP Server

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP connections, with Cloudflare OAuth built-in.

It integrates tools for running a sandbox container with your MCP client. With this server you can allow your LLM to run arbitrary code, such as Node or Python, in a secure, sandboxed environment.

The `/mcp` and `/sse` URLs use the same stateless SDK v2 handler and create a fresh server for every request. `/sse` is not the deprecated HTTP+SSE transport. `UserContainer` and `ContainerManager` remain application Durable Objects for per-user container lifecycle and capacity management; there is no MCP protocol session or protocol Durable Object.

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

## Connect to the MCP server

Connect your MCP client directly to `https://containers.mcp.cloudflare.com/mcp`. If prompted, complete the Cloudflare OAuth flow in your browser. The tools become available after authorization.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
