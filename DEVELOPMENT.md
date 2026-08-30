# Development setup

## Quick start

1. Install pnpm (v10+)
2. Run one-time environment setup:

```bash
pnpm dev:setup
```

3. Fill in `/home/runner/work/mcp-server-cloudflare/mcp-server-cloudflare/.env.development.local`
4. Start everything with one command:

```bash
pnpm dev
```

This starts every app in `apps/*` plus the unified dashboard.

## Unified dashboard

Open `http://127.0.0.1:8780` (or the printed reassigned port) to see:

- online/offline status for every app
- app tool/feature summaries
- quick links to each local endpoint and `/mcp`
- live aggregated logs from all apps
- environment-variable configuration status
- start/stop controls for each app

## Root scripts

- `pnpm dev` - start all MCP apps + unified dashboard
- `pnpm dev:miniflare` - start all MCP apps + dashboard with Miniflare mode for wrangler apps
- `pnpm dev:list` - list all available apps and default ports
- `pnpm dev:app <name>` - start one app + dashboard
- `pnpm dev:setup` - create `.env.development.local` from template
- `pnpm build` - build all apps/packages
- `pnpm check` - format check, lint, typecheck, test
- `pnpm deploy` - deploy all apps through turbo

## Port reference

| App | Default Port |
| --- | --- |
| docs-ai-search | 8801 |
| workers-bindings | 8802 |
| workers-builds | 8803 |
| workers-observability | 8804 |
| sandbox-container | 8805 |
| browser-rendering | 8806 |
| logpush | 8807 |
| ai-gateway | 8808 |
| autorag | 8809 |
| auditlogs | 8810 |
| dns-analytics | 8811 |
| dex-analysis | 8812 |
| cloudflare-one-casb | 8813 |
| radar | 8814 |
| cloudflare-blog | 8815 |
| demo-day | 8816 |
| graphql | 8817 |
| stack-mcp | 8818 |
| unified dashboard | 8780 |

If a port is already in use, the dev manager auto-selects the next available port and reports the reassignment in console + dashboard.

## Environment variables

Common variables across the repo:

- `CLOUDFLARE_ACCOUNT_ID`
- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_EMAIL`
- `CLOUDFLARE_CLIENT_ID`
- `CLOUDFLARE_CLIENT_SECRET`
- `MCP_SERVER_NAME`
- `MCP_SERVER_VERSION`

Additional optional flags:

- `DEV_DASHBOARD_PORT` (dashboard port override)
- `DEV_USE_MINIFLARE` (optional marker to indicate Miniflare test mode in your local env file)
- `DEV_DISABLE_OAUTH` (local convenience)
- `ENVIRONMENT` (`dev` by default)
- `BLOG_BASE_URL`, `SEARCH_BASE_URL` (cloudflare-blog)
- `CONTAINER_MANAGER`, `USER_CONTAINER` (sandbox-container)

### App -> required env vars

| App | Required env vars |
| --- | --- |
| ai-gateway, auditlogs, autorag, browser-rendering, graphql, logpush, workers-bindings | `CLOUDFLARE_CLIENT_ID`, `CLOUDFLARE_CLIENT_SECRET`, `MCP_SERVER_NAME`, `MCP_SERVER_VERSION` |
| cloudflare-one-casb | `CLOUDFLARE_CLIENT_ID`, `CLOUDFLARE_CLIENT_SECRET` |
| cloudflare-blog | `BLOG_BASE_URL`, `SEARCH_BASE_URL` |
| sandbox-container | `CLOUDFLARE_CLIENT_ID`, `CLOUDFLARE_CLIENT_SECRET`, `MCP_SERVER_NAME`, `MCP_SERVER_VERSION`, `CONTAINER_MANAGER`, `USER_CONTAINER` |
| demo-day, dex-analysis, dns-analytics, docs-ai-search, radar, stack-mcp, workers-builds, workers-observability | defaults-only local setup |

## Troubleshooting

- **`pnpm dev` fails immediately with missing binaries**: run `pnpm install` and retry.
- **need to verify local worker behavior**: run `pnpm dev:miniflare` to force `wrangler dev --local` where applicable.
- **dashboard is on a different port**: your preferred port was occupied; use the printed URL.
- **some apps show offline**: check the live log panel; app-specific credentials or APIs may be missing.
- **Ctrl+C does not stop children**: run Ctrl+C once more; the manager sends SIGTERM to all child processes.
