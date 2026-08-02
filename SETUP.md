# Setup

## Prerequisites

- Node.js 20+
- pnpm 10+
- Cloudflare account credentials for deploys

## Install

```bash
pnpm install
```

## Monorepo commands

- Start all app dev tasks through Turbo:

```bash
pnpm dev
```

- Type-check/build pipeline across workspaces:

```bash
pnpm build
```

- Run all workspace tests:

```bash
pnpm test
```

- Full repo checks (format, lint, types, tests):

```bash
pnpm check
```

- Deploy all deployable workspaces:

```bash
pnpm deploy
```

## Package-level commands

Run any command for one workspace:

```bash
pnpm --filter <workspace-name> <script>
```

Examples:

```bash
pnpm --filter cloudflare-ai-gateway-mcp-server dev
pnpm --filter @repo/mcp-common test
```

## Troubleshooting

- `pnpm install` peer dependency errors:
  - This repo uses strict peer dependency checks from `.npmrc`; resolve version mismatches instead of ignoring them.
- `pnpm check` lint errors:
  - Linting is centralized in root `.oxlintrc.json`. Fix issues in changed files and re-run `pnpm check`.
- Type errors across workspaces:
  - Ensure each workspace `tsconfig.json` extends `@repo/typescript-config/*` and re-run `pnpm build`.
- Deploy failures:
  - Confirm `CLOUDFLARE_ACCOUNT_ID` and `CLOUDFLARE_API_TOKEN` are set for the environment.
