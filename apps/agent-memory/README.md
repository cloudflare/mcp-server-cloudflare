# Cloudflare Agent Memory MCP Server

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It gives agents a persistent, semantically searchable memory. Files are stored in an R2 bucket in the **selected
Cloudflare account** and indexed with that account's Workers AI, so storage and inference spend are billed there. On
first write the server creates an R2 bucket (`agent-memory-mcp`) in the account. Files and their Durable Object search
index are account-scoped, so account members with the required permissions share the same memory.

## How it works

- **Storage** — every file lives in an R2 bucket in your account, addressed via the Cloudflare REST object API. Reads,
  writes, listing, and deletes all run against your bucket.
- **Search** — each file is embedded with Workers AI (`@cf/baai/bge-m3`), stored in a bounded in-memory vector index
  inside an account-scoped Durable Object (`idFromName(accountId)`), and queried by exact cosine similarity.
- **Reflection** — an on-demand agentic pass that scans memory, auto-applies low-risk fixes, and stages substantive
  improvements for review. It is **opt-out** (`set_config { reflectionsEnabled: false }`) and runs only when you call
  `run_reflection` — there is no background cron. All LLM spend is billed to the selected account.
- **Notifications** — configure a generic webhook (`set_config { webhookUrl }`) to receive a JSON POST when a
  reflection finishes. Use a Worker or automation endpoint to adapt the generic payload for vendor-specific webhooks.

Memory is shared by authorized members of the selected account. The managed server limits individual objects to 5 MB,
directory listings to 1,000 results, and the search index to 5,000 entries. Use narrower directories and `reindex` in
batches when repairing larger collections.

## 🔨 Available Tools

| **Category**      | **Tool**                   | **Description**                                                        |
| ----------------- | -------------------------- | ---------------------------------------------------------------------- |
| **Files**         | `read`                     | Read one file or up to 50 files from memory storage                    |
|                   | `write`                    | Write a file; auto-indexes tags and `[[wikilinks]]`, warns on overlaps |
|                   | `write_many`               | Write up to 50 files in one call                                       |
|                   | `reindex`                  | Repair search metadata for up to 50 stored files                       |
|                   | `list`                     | List files in a directory, optionally filtered by tags                 |
|                   | `list_tags`                | List all indexed tags with file counts                                 |
|                   | `get_backlinks`            | List files linking to a target via `[[wikilinks]]`                     |
| **Search**        | `search`                   | Semantic search across memory files                                    |
| **Conversations** | `search_conversations`     | Semantic search across indexed conversations                           |
|                   | `index_conversations`      | Index conversation sessions from a sync script                         |
|                   | `expand_conversation`      | Load full context from a past conversation session                     |
|                   | `conversation_stats`       | Statistics about indexed conversations                                 |
| **Reminders**     | `schedule_reminder`        | Create a one-off or recurring reminder                                 |
|                   | `list_reminders`           | List all scheduled reminders                                           |
|                   | `remove_reminder`          | Remove a scheduled reminder                                            |
|                   | `check_reminders`          | Check for fired reminders                                              |
| **Reflection**    | `run_reflection`           | Run an agentic reflection over memory now (opt-out, billed to you)     |
|                   | `list_pending_reflections` | List pending reflection files awaiting review                          |
|                   | `apply_reflection_changes` | Apply proposed changes from a reflection                               |
|                   | `archive_reflection`       | Archive a pending reflection without applying changes                  |
| **Config**        | `get_config`               | Get your reflection / webhook / model configuration                    |
|                   | `set_config`               | Update config: opt out of reflections, set a webhook, override models  |

### Prompt Examples

- `Remember that our staging DB rotates credentials every 90 days.`
- `Search my memory for how we handle rate limiting.`
- `Write a note tagged #architecture describing the new queue design.`
- `What files link to [[projects/dodo]]?`
- `Index these conversation sessions.`
- `Remind me to review the escalation backlog every Monday at 9am.`
- `Run a reflection over my memory.`
- `Turn off reflections.`
- `Send reflection notifications to my automation Worker at https://example.com/reflections.`

## Access the remote MCP server from any MCP Client

If your MCP client has first class support for remote MCP servers, provide the server URL
(`https://memory.mcp.cloudflare.com/mcp`) directly in its interface.

If your client does not yet support remote MCP servers, use [mcp-remote](https://www.npmjs.com/package/mcp-remote):

```json
{
	"mcpServers": {
		"cloudflare-memory": {
			"command": "npx",
			"args": ["mcp-remote", "https://memory.mcp.cloudflare.com/mcp"]
		}
	}
}
```

Restart your MCP client and a browser window will open showing the OAuth login page. After you grant access, the tools
become available.

Interested in contributing, and running this server locally? See [CONTRIBUTING.md](CONTRIBUTING.md) to get started.
