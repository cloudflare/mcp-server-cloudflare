# Workers Scripts MCP Server

Manage Cloudflare Workers scripts, versions, and deployments using Cloudflare OAuth.
The server uses the repository's stateless Agents SDK MCP handler at `/mcp` and retains
no MCP protocol session or active Worker selection.

## Tools

| Tool                         | Description                                                                      |
| ---------------------------- | -------------------------------------------------------------------------------- |
| `workers_scripts_list`       | List scripts in the selected account.                                            |
| `workers_scripts_download`   | Download a script's raw content.                                                 |
| `workers_scripts_upload`     | Create or replace a single-module script and immediately publish it.             |
| `workers_versions_upload`    | Upload a version without changing live traffic.                                  |
| `workers_versions_list`      | List a script's versions, optionally filtering for deployable versions.          |
| `workers_scripts_delete`     | Delete the explicitly named script.                                              |
| `workers_deployments_list`   | List deployments for a script.                                                   |
| `workers_deployments_get`    | Get one deployment by UUID.                                                      |
| `workers_deployments_create` | Assign traffic percentages to explicit version UUIDs.                            |
| `workers_deployments_delete` | Delete a deployment by UUID; Cloudflare prevents deleting the active deployment. |

Uploads in this server accept one JavaScript ES module and a compatibility date. Existing
named bindings are inherited from the latest version, but these tools cannot add or change
bindings, upload additional modules or assets, or manage Durable Object migrations. Existing
compatibility flags are retained when omitted. For a staged rollout, upload a version and then
create a deployment; version traffic percentages must total 100. Script upload publishes
immediately. Script deletion is permanent, does not expose force deletion, and may also delete
the Worker's Durable Object namespaces and stored data.

The OAuth grant requests `workers:read` and `workers:write` scopes. The associated Cloudflare
API token must have Workers Scripts Read and Workers Scripts Write permissions.

## Local development

Follow [the repository's local development guide](../../CONTRIBUTING.md), and create a
`.dev.vars` file using `.dev.vars.example`. Start this app with:

```sh
pnpm --filter workers-scripts dev
```

Before staging or production deployment, provision a dedicated `OAUTH_KV` namespace for
each environment and replace the `WORKERS_SCRIPTS_STAGING_KV` and
`WORKERS_SCRIPTS_PRODUCTION_KV` placeholder IDs in `wrangler.jsonc`.
