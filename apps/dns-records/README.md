# Cloudflare DNS Records MCP Server

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It provides tools for managing DNS records through the [Cloudflare DNS Records API](https://developers.cloudflare.com/api/resources/dns/subresources/records/), enabling full CRUD operations on DNS records for any zone in your Cloudflare account.

## 🔨 Available Tools

| **Category**         | **Tool**            | **Description**                                                       |
| -------------------- | ------------------- | --------------------------------------------------------------------- |
| **Zone Information** | `zones_list`        | List zones under the current active account.                          |
| **DNS Records**      | `dns_records_list`  | List DNS records for a zone, with optional type and name filters.     |
| **DNS Records**      | `dns_record_get`    | Get details of a specific DNS record by its ID.                       |
| **DNS Records**      | `dns_record_create` | Create a new DNS record (A, AAAA, CNAME, MX, TXT, NS, SRV, CAA, PTR). |
| **DNS Records**      | `dns_record_update` | Update an existing DNS record (PATCH — only changed fields).          |
| **DNS Records**      | `dns_record_delete` | Delete a DNS record from a zone.                                      |

### Prompt Examples

- `List all DNS records for my zone.`
- `Show me the CNAME records for example.com.`
- `Create an A record pointing app.example.com to 203.0.113.50.`
- `Create a CNAME record pointing blog.example.com to my-blog.pages.dev.`
- `Add a TXT record for _dmarc.example.com with value "v=DMARC1; p=reject".`
- `Update the A record for example.com to point to 198.51.100.1.`
- `Delete the TXT record with ID abc123 from my zone.`
- `What MX records are configured for my domain?`

## Access the remote MCP server from any MCP Client

If your MCP client has first class support for remote MCP servers, the client will provide a way to accept the server URL directly within its interface (for example in [Cloudflare AI Playground](https://playground.ai.cloudflare.com/)).

If your client does not yet support remote MCP servers, you will need to set up its respective configuration file using [mcp-remote](https://www.npmjs.com/package/mcp-remote) to specify which servers your client can access.

Replace the content with the following configuration:

```json
{
	"mcpServers": {
		"cloudflare-dns-records": {
			"command": "npx",
			"args": ["mcp-remote", "https://dns-records.mcp.cloudflare.com/mcp"]
		}
	}
}
```

Once you've set up your configuration file, restart MCP client and a browser window will open showing your OAuth login page. Proceed through the authentication flow to grant the client access to your MCP server. After you grant access, the tools will become available for you to use.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
