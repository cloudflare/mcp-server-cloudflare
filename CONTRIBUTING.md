# Developing

We welcome contributions to all of our MCP servers! Here's a quick run down on how to get started.

## Architecture

This monorepo has two top-level directories: `/apps` and `/packages`.

- **/apps**: Containing directories for each server. Some servers include a
  `CONTRIBUTING.md` with special setup instructions:
  - [apps/ai-gateway](apps/ai-gateway/CONTRIBUTING.md)
  - [apps/autorag](apps/autorag/CONTRIBUTING.md)
  - [apps/browser-rendering](apps/browser-rendering/CONTRIBUTING.md)
  - [apps/dns-analytics](apps/dns-analytics/CONTRIBUTING.md)
  - [apps/radar](apps/radar/CONTRIBUTING.md)
  - [apps/sandbox-container](apps/sandbox-container/CONTRIBUTING.md)
  - [apps/workers-bindings](apps/workers-bindings/CONTRIBUTING.md)
  - [apps/workers-builds](apps/workers-builds/CONTRIBUTING.md)
  - [apps/workers-observability](apps/workers-observability/CONTRIBUTING.md)
- **/packages**: Containing shared packages used across our various apps.
  - packages/eslint-config: Eslint config used by all apps and packages.
  - packages/typescript-config: tsconfig used by all apps and packages.
  - packages/mcp-common: Shared common tools and scripts to help manage this repo.

We use [TurboRepo](https://turbo.build/) and [pnpm](https://pnpm.io/) to manage this repository. TurboRepo manages the monorepo by ensuring commands are run across all apps.

## Getting Started

This section will guide you through setting up your developer environment and running tests.

### Installation

Install dependencies:

```bash
pnpm install
```

### Testing

The project uses Vitest as the testing framework with [fetchMock](https://developers.cloudflare.com/workers/testing/vitest-integration/test-apis/) for API mocking.

#### Running Tests

To run all tests:

```bash
pnpm test
```

To run a specific test file:

```bash
pnpm test -- tests/tools/queues.test.ts
```

To run tests in watch mode (useful during development):

```bash
pnpm test:watch
```
