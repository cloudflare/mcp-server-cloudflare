# Cloudflare Workers Bindings MCP Server

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It integrates tools for managing resources in the Cloudflare Workers Platform, which you can connect to your Worker via [Bindings](https://developers.cloudflare.com/workers/runtime-apis/bindings/).

## 🔨 Available Tools

Currently available tools:

| **Category**      | **Tool**                   | **Description**                                                               |
| ----------------- | -------------------------- | ----------------------------------------------------------------------------- |
| **Account**       | `accounts_list`            | List all accounts in your Cloudflare account                                  |
|                   | `set_active_account`       | Set active account to be used for tool calls that require accountId           |
| **KV Namespaces** | `kv_namespaces_list`       | List all of the kv namespaces in your Cloudflare account                      |
|                   | `kv_namespace_create`      | Create a new kv namespace in your Cloudflare account                          |
|                   | `kv_namespace_delete`      | Delete a kv namespace in your Cloudflare account                              |
|                   | `kv_namespace_get`         | Get details of a kv namespace in your Cloudflare account                      |
|                   | `kv_namespace_update`      | Update the title of a kv namespace in your Cloudflare account                 |
| **Workers**       | `workers_list`             | List all Workers in your Cloudflare account                                   |
|                   | `workers_get_worker`       | Get the details of a Cloudflare Worker                                        |
|                   | `workers_get_worker_code`  | Get the source code of a Cloudflare Worker                                    |
| **R2 Buckets**    | `r2_buckets_list`          | List r2 buckets in your Cloudflare account                                    |
|                   | `r2_bucket_create`         | Create a new r2 bucket in your Cloudflare account                             |
|                   | `r2_bucket_get`            | Get details about a specific R2 bucket                                        |
|                   | `r2_bucket_delete`         | Delete an R2 bucket                                                           |
| **D1 Databases**  | `d1_databases_list`        | List all of the D1 databases in your Cloudflare account                       |
|                   | `d1_database_create`       | Create a new D1 database in your Cloudflare account                           |
|                   | `d1_database_delete`       | Delete a d1 database in your Cloudflare account                               |
|                   | `d1_database_get`          | Get a D1 database in your Cloudflare account                                  |
|                   | `d1_database_query`        | Query a D1 database in your Cloudflare account                                |
| **Hyperdrive**    | `hyperdrive_configs_list`  | List Hyperdrive configurations in your Cloudflare account                     |
|                   | `hyperdrive_config_create` | Create a new Hyperdrive configuration in your Cloudflare account              |
|                   | `hyperdrive_config_delete` | Delete a Hyperdrive configuration in your Cloudflare account                  |
|                   | `hyperdrive_config_get`    | Get details of a specific Hyperdrive configuration in your Cloudflare account |
|                   | `hyperdrive_config_edit`   | Edit (patch) a Hyperdrive configuration in your Cloudflare account            |

This MCP server is still a work in progress, and we plan to add more tools in the future.

### Prompt Examples

- `List my Cloudflare accounts.`
- `Set my active account to 'YOUR_ACCOUNT_ID'.` (Replace YOUR_ACCOUNT_ID with an actual ID)
- `Show me my KV namespaces.`
- `Create a new KV namespace called 'my-kv-store'.`
- `Get the details for KV namespace 'YOUR_NAMESPACE_ID'.` (Replace YOUR_NAMESPACE_ID)
- `Delete the KV namespace 'NAMESPACE_TO_DELETE_ID'.` (Replace NAMESPACE_TO_DELETE_ID)
- `List my Cloudflare Workers.`
- `Get the code for the 'my-worker-script' worker.`
- `Show me my R2 buckets.`
- `Create an R2 bucket named 'my-new-bucket'.`
- `Get details for the R2 bucket 'my-data-bucket'.`
- `Delete the R2 bucket 'old-bucket'.`
- `List my D1 databases.`
- `Create a D1 database named 'analytics-db'.`
- `Get details for D1 database 'YOUR_D1_DB_ID'.` (Replace YOUR_D1_DB_ID)
- `Run the query 'SELECT * FROM customers LIMIT 10;' on D1 database 'YOUR_D1_DB_ID'.` (Replace YOUR_D1_DB_ID)
- `Delete the D1 database 'TEMP_DB_ID'.` (Replace TEMP_DB_ID)
- `List my Hyperdrive configurations.`
- `Create a Hyperdrive config named 'prod-db-cache' for my database.` (You might need to provide more origin details)
- `Get details for Hyperdrive config 'YOUR_HYPERDRIVE_ID'.` (Replace YOUR_HYPERDRIVE_ID)
- `Update the cache settings for Hyperdrive config 'YOUR_HYPERDRIVE_ID'.` (Replace YOUR_HYPERDRIVE_ID)
- `Delete the Hyperdrive config 'OLD_HYPERDRIVE_ID'.` (Replace OLD_HYPERDRIVE_ID)

## Access the remote MCP server from any MCP Client

If your MCP client has first class support for remote MCP servers, the client will provide a way to accept the server URL (`https://bindings.mcp.cloudflare.com`) directly within its interface (for example in [Cloudflare AI Playground](https://playground.ai.cloudflare.com/)).

If your client does not yet support remote MCP servers, you will need to set up its respective configuration file using [mcp-remote](https://www.npmjs.com/package/mcp-remote) to specify which servers your client can access.

Replace the content with the following configuration:

```json
{
	"mcpServers": {
		"cloudflare": {
			"command": "npx",
			"args": ["mcp-remote", "https://bindings.mcp.cloudflare.com/sse"]
		}
	}
}
```

Once you've set up your configuration file, restart MCP client and a browser window will open showing your OAuth login page. Proceed through the authentication flow to grant the client access to your MCP server. After you grant access, the tools will become available for you to use.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
