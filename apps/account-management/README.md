# Cloudflare Account Management MCP Server 📡

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It integrates the [Cloudflare Account Members API](https://developers.cloudflare.com/api/node/resources/accounts/subresources/members/) to allow you to manage your Cloudflare account members.

## 🔨 Available Tools

Currently available tools:

| **Tool**               | **Description**                                                              |
| ---------------------- | ---------------------------------------------------------------------------- |
| `get_members_in_account` | Retrieves the members in the specified account.                             |
| `get_roles`     | Fetches the roles in the specified account.            |
| `invite_to_account`   | Invites a user to the specified account. NOTE: You will have to use the email address of the user you want to invite. |
| `update_member`   | Updates a member in the specified account. |
| `remove_member`   | Removes a member from the specified account. |

**Note:** To use these tools, ensure you have an active account set. If not, use `accounts_list` to list your accounts and `set_active_account` to set one as active.

This MCP server is still a work in progress, and we plan to add more tools in the future.

### Prompt Examples

- `Get the members in my account.`
- `Get the roles in my account.`
- `Invite a user to my account.`
- `Update a member in my account.`
- `Remove a member from my account.`

## Access the remote MCP server from any MCP Client

If your MCP client has first class support for remote MCP servers, the client will provide a way to accept the server URL (`https://account-management.mcp.cloudflare.com`) directly within its interface (for example in[Cloudflare AI Playground](https://playground.ai.cloudflare.com/)).

If your client does not yet support remote MCP servers, you will need to set up its resepective configuration file using mcp-remote (https://www.npmjs.com/package/mcp-remote) to specify which servers your client can access.

Replace the content with the following configuration:

```json
{
	"mcpServers": {
		"account-management": {
			"command": "npx",
			"args": ["mcp-remote", "https://account-management.mcp.cloudflare.com/sse"]
		}
	}
}
```

Once you've set up your configuration file, restart MCP client and a browser window will open showing your OAuth login page. Proceed through the authentication flow to grant the client access to your MCP server. After you grant access, the tools will become available for you to use.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
