# Cloudflare Agent Memory MCP Server

This is a [Model Context Protocol (MCP)](https://modelcontextprotocol.io/introduction) server that supports remote MCP
connections, with Cloudflare OAuth built-in.

It gives agents a persistent, semantically searchable memory. Files are stored in **your own R2 bucket** and indexed
with **your own Workers AI** embeddings, so all storage and inference spend is billed to the Cloudflare account you
authenticate with. On first use the server creates an R2 bucket (`agent-memory-mcp`) in your account and a per-user
vector index backed by a Durable Object.

## How it works

- **Storage** — every file lives in an R2 bucket in your account, addressed via the Cloudflare REST object API. Reads,
  writes, listing, and deletes all run against your bucket.
- **Search** — content is chunked and embedded with Workers AI (`@cf/baai/bge-*`), stored in an in-memory HNSW index
  inside a per-user Durable Object (`idFromName(userId)`), and queried by cosine similarity.
- **Reflection** — an on-demand agentic pass that scans your memory, auto-applies low-risk fixes, and proposes
  substantive improvements. It is **opt-out** (`set_config { reflectionsEnabled: false }`) and runs only when you call
  `run_reflection` — there is no background cron. All LLM spend is billed to your account.
- **Notifications** — configure a generic webhook (`set_config { webhookUrl }`) to receive a JSON POST when a
  reflection finishes. Works with Slack, Discord, a Worker, n8n, or any HTTP endpoint.

## 🔨 Available Tools

| **Category**      | **Tool**                   | **Description**                                                        |
| ----------------- | -------------------------- | ---------------------------------------------------------------------- |
| **Files**         | `read`                     | Read one file or up to 50 files from memory storage                    |
|                   | `write`                    | Write a file; auto-indexes tags and `[[wikilinks]]`, warns on overlaps |
|                   | `write_many`               | Write up to 50 files in one call                                       |
|                   | `list`                     | List files in a directory, optionally filtered by tags                 |
|                   | `list_tags`                | List all indexed tags with file counts                                 |
|                   | `get_backlinks`            | List files linking to a target via `[[wikilinks]]`                     |
|                   | `history`                  | List prior versions of a file (unavailable on REST storage)            |
|                   | `rollback`                 | Restore a prior version (unavailable on REST storage)                  |
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
- `Send reflection notifications to this Slack webhook: https://hooks.slack.com/...`

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
