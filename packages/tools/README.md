# @repo/tools

A collection of shared scripts for automating the monorepo while ensuring consistency across packages.

## Scripts

### Bin Scripts

Simple shell scripts for common development tasks:

- `run-tsc`: Run TypeScript type checking
- `run-eslint-workers`: Run ESLint checks
- `run-vitest`: Run tests
- `run-vitest-ci`: Run tests in CI mode
- `run-turbo`: Run Turbo commands with tracking disabled
- `run-wrangler-deploy`: Deploy using Wrangler
- `run-wrangler-types`: Generate Wrangler types
- `run-fix-deps`: Fix dependencies

### Runx CLI

A TypeScript-based CLI for more complex automation tasks. While the bin scripts work well for simple tasks, the runx CLI provides better type safety and more sophisticated programmatic control.

Usage:

```bash
pnpm runx <command> [options]
```

Available commands:

- `deploy-published-workers`: Deploy Cloudflare Workers (based on which packages changesets marked as published in the release).

Note:

The CLI will automatically use Bun if available, but falls back to tsx if not installed.
