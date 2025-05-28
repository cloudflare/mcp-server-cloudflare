# Cloudflare AI Gateway MCP Server 📡

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It integrates tools powered by the [Cloudflare AI Gateway API](https://developers.cloudflare.com/ai-gateway/) to provide global
Internet traffic insights, trends and other utilities.

## 🔨 Available Tools

Currently available tools:

| **Tool**                | **Description**                                                                                                                     |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| `list_gateways`         | Lists all AI Gateways associated with the account, supporting pagination for easy navigation.                                       |
| `list_logs`             | Retrieves logs for a specified gateway, offering filters such as date ranges, feedback scores, success status, model, and provider. |
| `get_log_details`       | Fetches detailed information about a specific log identified by its log ID within a gateway.                                        |
| `get_log_request_body`  | Retrieves the request body associated with a specific log in a gateway.                                                             |
| `get_log_response_body` | Retrieves the response body associated with a specific log in a gateway.                                                            |

**Note:** To use these tools, ensure you have an active account set. If not, use `accounts_list` to list your accounts and `set_active_account` to set one as active.

This MCP server is still a work in progress, and we plan to add more tools in the future.

### Prompt Examples

- `List all my AI Gateways.`
- `Show logs for gateway 'gateway-001' between January 1, 2023, and January 31, 2023.`
- `Fetch the latest errors from gateway-001 and debug what might have happened wrongly`

## Access the remote MCP server from any MCP Client

If your MCP client has first class support for remote MCP servers, the client will provide a way to accept the server URL (`https://ai-gateway.mcp.cloudflare.com`) directly within its interface (for example in[Cloudflare AI Playground](https://playground.ai.cloudflare.com/)).

If your client does not yet support remote MCP servers, you will need to set up its resepective configuration file using mcp-remote (https://www.npmjs.com/package/mcp-remote) to specify which servers your client can access.

Replace the content with the following configuration:

```json
{
	"mcpServers": {
		"cloudflare": {
			"command": "npx",
			"args": ["mcp-remote", "https://ai-gateway.mcp.cloudflare.com/sse"]
		}
	}
}
```

Once you've set up your configuration file, restart MCP client and a browser window will open showing your OAuth login page. Proceed through the authentication flow to grant the client access to your MCP server. After you grant access, the tools will become available for you to use.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.

### Resources 

<details>
<summary><b>Open MCP Marketplace API Support</b></summary>

![MCP Marketplace User Review Rating Badge](http://www.deepnlp.org/api/marketplace/svg?cloudflare/mcp-server-cloudflare)|[Reviews](http://www.deepnlp.org/store/ai-agent/mcp-server/pub-cloudflare/mcp-server-cloudflare)|[GitHub](https://github.com/AI-Agent-Hub/mcp-marketplace)|[Doc](http://www.deepnlp.org/doc/mcp_marketplace)|[MCP Marketplace](http://www.deepnlp.org/store/ai-agent/mcp-server)

Allow AI/Agent/LLM to find this MCP Server via common python/typescript API, search and explore relevant servers and tools

***Example: Search Server and Tools***
```python
import anthropic
import mcp_marketplace as mcpm

result_q = mcpm.search(query="mcp server cloudflare", mode="list", page_id=0, count_per_page=100, config_name="deepnlp") # search server by category choose various endpoint
result_id = mcpm.search(id="cloudflare/mcp-server-cloudflare", mode="list", page_id=0, count_per_page=100, config_name="deepnlp")      # search server by id choose various endpoint 
tools = mcpm.list_tools(id="cloudflare/mcp-server-cloudflare", config_name="deepnlp_tool")
# Call Claude to Choose Tools Function Calls 
# client = anthropic.Anthropic()
# response = client.messages.create(model="claude-opus-4-20250514", max_tokens=1024, tools=tools, messages=[])
```

</details>

