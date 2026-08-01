# AGENT_SKILLS_PLAN.md - Comprehensive Team Dispatch & Execution Strategy
# Using Mise, Roborev, and Awesome Copilot Skills

## Executive Summary

This document outlines a **production-ready team dispatch system** leveraging:
- **Mise** (https://mise.jdx.dev/) - Universal version manager & task orchestrator
- **Roborev** (https://roborev.io/) - AI-powered code review & automation CLI
- **Awesome Copilot Skills** (https://github.com/github/awesome-copilot) - Reusable agent capabilities
- **GitHub Copilot Agent Teams** - Specialized agents for parallel work execution

---

## Part 1: Core Infrastructure Setup

### 1.1 Install Mise (Universal Tool Manager)

```bash
# Quick install
curl https://mise.run | sh

# Add to shell config (~/.zshrc, ~/.bashrc, etc.)
eval "$(~/.local/bin/mise activate bash)"

# Verify
mise --version
```

### 1.2 Install Roborev (AI Code Review & Automation)

```bash
# Install from roborev.io
curl -fsSL https://roborev.io/install.sh | bash

# Verify
roborev --version

# Login with GitHub
roborev auth login
```

### 1.3 Configure Mise for MCP Monorepo

Already added: See `mise.toml` at repository root with:
- **Tools**: Node 20, pnpm 10.8.0, Turbo 2.10.7
- **Environment**: PNPM_HOME, NODE_ENV, FORCE_COLOR
- **Tasks**: 50+ orchestrated tasks (dev, build, test, deploy, etc.)

**Quick validation:**
```bash
mise run validate:tools
mise run health
```

---

## Part 2: Agent Skills from Awesome Copilot

### 2.1 Available Skills Catalog

| Skill | Purpose | Use Case | Team |
|-------|---------|----------|------|
| `monorepo-architecture` | Coordinate workspace setup | Refactor package structure | BUILD |
| `typescript-config` | Unified TS configs | Fix TypeScript conflicts | BUILD |
| `eslint-prettier-setup` | Linting & formatting | Consolidate oxlint/prettier | BUILD |
| `github-actions-ci` | CI/CD automation | Setup workflows | DEPLOY |
| `dev-environment-setup` | Dev orchestration | Single-command launch | DEV |
| `dependency-audit` | Dependency management | Audit & cleanup | DEV |
| `auto-docs` | Documentation generation | Create SETUP.md, DEVELOPMENT.md | BUILD |
| `mcp-builder-skill` | MCP server patterns | Build new MCP apps | ALL (custom) |

### 2.2 Install Skills Locally

```bash
# Clone awesome-copilot
git clone https://github.com/github/awesome-copilot.git ~/.copilot/awesome-copilot

# Create symlinks to project-specific skills
mkdir -p .agent/skills

ln -s ~/.copilot/awesome-copilot/skills/monorepo-architecture .agent/skills/
ln -s ~/.copilot/awesome-copilot/skills/typescript-config .agent/skills/
ln -s ~/.copilot/awesome-copilot/skills/eslint-prettier-setup .agent/skills/
ln -s ~/.copilot/awesome-copilot/skills/github-actions-ci .agent/skills/
ln -s ~/.copilot/awesome-copilot/skills/dev-environment-setup .agent/skills/
ln -s ~/.copilot/awesome-copilot/skills/dependency-audit .agent/skills/
ln -s ~/.copilot/awesome-copilot/skills/auto-docs .agent/skills/

# Custom skills already in repo
ls -la .agent/skills/
```

### 2.3 Create `.agent/skills/mcp-builder-skill/SKILL.md`

Already created! See `.agent/skills/mcp-builder-skill/SKILL.md` for comprehensive MCP development guide.

---

## Part 3: Team Structure & Dispatch

### 3.1 Four Specialized Agent Teams

```
┌──────────────────────────────────────────────────────────────┐
│         DISPATCH COORDINATOR (Main CCA Agent)                │
│    Oversees all teams, runs mise orchestration tasks          │
└──────────────────────┬───────────────────────────────────────┘
                       │
        ┌──────────────┼──────────────┬─────────────────┐
        │              │              │                 │
    ┌───▼────┐     ┌──▼────┐     ┌──▼────┐         ┌──▼────┐
    │  BUILD  │     │  DEV   │     │DEPLOY │         │ INFRA │
    │  TEAM   │     │ TEAM   │     │ TEAM  │         │ TEAM  │
    └───┬────┘     └──┬────┘     └──┬────┘         └──┬────┘
        │              │              │                 │
   Phase 1-2        Phase 1-2      Phase 2           Phase 3
```

### 3.2 Team Assignments

#### **TEAM 1: BUILD CONFIGURATION**
**Skills**: typescript-config, eslint-prettier-setup, monorepo-architecture, auto-docs  
**Lead Agent**: `@agent-build-config`  
**Tasks (5 days)**:

```bash
# Day 1: Audit & Plan
/skill typescript-config
"Analyze current TypeScript setup across monorepo"

# Day 2: Consolidate TypeScript
mise run validate:types  # Current state
# Fix: merge @repo/typescript-config
# Fix: align versions (5.5.4 → 7.0.2)

# Day 3: Centralize Linting
/skill eslint-prettier-setup
mise run validate:lint  # Test
# Create: .oxlintrc.json at root
# Remove: .eslintrc.cjs from packages

# Day 4: Formatting
mise run format:check
# Create: .prettierrc.json
# Create: .npmrc

# Day 5: Documentation
/skill auto-docs
# Generate: SETUP.md, BUILD.md
mise run docs:build
```

**Deliverable**: PR #1 - "Centralize Build Tooling & Configs"

---

#### **TEAM 2: DEVELOPMENT ENVIRONMENT**
**Skills**: dev-environment-setup, dependency-audit  
**Lead Agent**: `@agent-dev-environment`  
**Tasks (5 days)**:

```bash
# Day 1: Audit Dependencies
/skill dependency-audit
mise run deps:audit
# Report: Identify 17+ tsup plugins
# Report: Consolidate Vite plugins

# Day 2: Fix Conflicts
mise run deps:check
# Create: pnpm.overrides for version conflicts
# Fix: esbuild versions
# Validate: pnpm install succeeds

# Day 3: Environment Templates
/skill dev-environment-setup
# Create: .env.development.local template
# Create: .env.example per app
# Document: All required vars

# Day 4: Unified Dev Scripts
mise run dev:dashboard
# Update: root package.json scripts
# Create: app orchestration (concurrently)
# Define: Port allocation table

# Day 5: Integration Test
mise run dev
# Verify: All apps launch
# Verify: Dashboard accessible
```

**Deliverable**: PR #2 - "Unified Development Setup & Dependencies"

---

#### **TEAM 3: DEPLOYMENT & ORCHESTRATION**
**Skills**: github-actions-ci, dev-environment-setup  
**Lead Agent**: `@agent-deploy-orchestration`  
**Tasks (5 days)**:

```bash
# Day 1: Dashboard UI
# Create: apps/dev-dashboard/
# Stack: React + Vite
# Features: Status, logs, ports, tool listing

# Day 2: Process Management
# Integrate: concurrently or Turbo for app launching
# Implement: Health checks
# Implement: Graceful shutdown

# Day 3: GitHub Actions CI
/skill github-actions-ci
# Create: .github/workflows/build.yml
# Matrix: Node 18, 20, 22
# Stages: Lint → TypeCheck → Test

# Day 4: Deployment Automation
# Create: .github/workflows/deploy.yml
# Staging: Auto-deploy on PR merge
# Production: Require approval
# Secrets: Cloudflare tokens

# Day 5: Release Automation
# Create: Changeset workflow
# Create: Auto-versioning
# Create: GitHub Releases
```

**Deliverable**: PR #3 - "Dashboard UI & CI/CD Automation"

---

#### **TEAM 4: INFRASTRUCTURE & MONITORING**
**Skills**: mcp-builder-skill, github-actions-ci  
**Lead Agent**: `@agent-infrastructure`  
**Tasks (3 days)**:

```bash
# Day 1: Health Checks & Monitoring
# Create: /health endpoints per MCP server
# Integrate: Cloudflare Workers Analytics
# Setup: Error tracking (Sentry)

# Day 2: Performance Optimization
# Optimize: Build caching (Turbo)
# Optimize: Dependency resolution
# Profile: Bundle sizes

# Day 3: Documentation & Runbook
# Create: OPERATIONS.md
# Create: TROUBLESHOOTING.md
# Create: On-call runbook
```

**Deliverable**: PR #4 - "Infrastructure, Monitoring & Operations"

---

## Part 4: Execution Timeline

### Week 1: Foundation (Mon-Fri)

```
Monday:
  ├─ Team 1 (Build Config) - Day 1 starts
  ├─ Team 2 (Dev Env) - Day 1 starts
  └─ Dispatch meeting (15 min sync)

Tuesday:
  ├─ Team 1 - Day 2 (TypeScript)
  ├─ Team 2 - Day 2 (Dependencies)
  └─ PR reviews

Wednesday:
  ├─ Team 1 - Day 3 (Linting)
  ├─ Team 2 - Day 3 (Env Templates)
  └─ Integration check

Thursday:
  ├─ Team 1 - Day 4 (Formatting)
  ├─ Team 2 - Day 4 (Dev Scripts)
  └─ Local test run: mise run dev

Friday:
  ├─ Team 1 - Day 5 (Docs) → PR #1 MERGE
  ├─ Team 2 - Day 5 (Integration) → PR #2 MERGE
  └─ Week 1 validation: mise run check
```

### Week 2: Orchestration & Deployment (Mon-Fri)

```
Monday:
  ├─ Team 3 (Dashboard) - Day 1 starts
  ├─ Team 4 (Infrastructure) - Day 1 starts
  └─ Pre-reqs: PR #1 & #2 merged

Wednesday:
  └─ Team 3 - Day 3 (GitHub Actions CI)

Friday:
  ├─ Team 3 - Day 5 → PR #3 MERGE
  ├─ Team 4 - Day 3 → PR #4 MERGE
  └─ Full integration test: mise run ci
```

---

## Part 5: Mise Tasks for Each Phase

### Phase 1: Validation & Setup

```bash
# Validate all tools are present
mise run validate:tools

# Validate all config files
mise run validate:format
mise run validate:lint
mise run validate:types
mise run validate:deps

# Full health check
mise run health
```

### Phase 2: Development

```bash
# Start all MCP servers + dashboard
mise run dev

# Or start specific app
mise run dev:app -- workers-builds

# Watch mode: lint, types, build
mise run dev:lint
mise run dev:types
mise run build:watch
```

### Phase 3: Quality Checks

```bash
# Quick check
mise run check

# Comprehensive check
mise run validate:all

# With test coverage
mise run test:coverage
```

### Phase 4: Deployment

```bash
# Deploy to staging
mise run deploy:staging

# Deploy to production
mise run deploy:prod

# Verify deployments
mise run deploy:verify
```

---

## Part 6: Roborev Integration for Code Review

### 6.1 Setup Roborev

```bash
# Install
curl -fsSL https://roborev.io/install.sh | bash

# Login
roborev auth login

# Configure for repo
roborev config init
```

### 6.2 Review PRs Automatically

```bash
# Review PR #1 (Build Config)
roborev review --pr 1

# Fix issues suggested by roborev
roborev fix --pr 1

# Re-run validation
mise run validate:all
```

### 6.3 Roborev in CI Pipeline

```yaml
# .github/workflows/roborev-check.yml
name: Roborev Review

on: [pull_request]

jobs:
  review:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: curl -fsSL https://roborev.io/install.sh | bash
      - run: roborev auth set-token ${{ secrets.ROBOREV_TOKEN }}
      - run: roborev review
      - run: roborev fix
```

---

## Part 7: Agent Dispatch Commands

### Quick Start: Execute All Teams

```bash
# 1. Setup environment
mise run setup

# 2. Dispatch Build Team
@agent-build-config /skill typescript-config
"Consolidate TypeScript configs: fix version conflicts, merge workers.json + tools.json"

# 3. Dispatch Dev Team
@agent-dev-environment /skill dependency-audit
"Audit dependencies, identify conflicts, create pnpm.overrides, consolidate packages"

# 4. Dispatch Deploy Team (after #1 & #2 merge)
@agent-deploy-orchestration /skill github-actions-ci
"Create unified dashboard, setup GitHub Actions workflows, orchestrate app launches"

# 5. Dispatch Infrastructure Team (after #3 merges)
@agent-infrastructure /skill mcp-builder-skill
"Setup health checks, monitoring, operations documentation, performance optimization"
```

### Per-Team Detailed Dispatch

**Team 1 - Build Config**
```bash
@agent-build-config
/skill typescript-config /skill eslint-prettier-setup
"Phase 1: Audit current setup
Phase 2: Fix TypeScript version conflicts (5.5.4 → 7.0.2)
Phase 3: Consolidate oxlint config to .oxlintrc.json
Phase 4: Consolidate prettier config to .prettierrc.json
Phase 5: Document in SETUP.md
All phases tested with: mise run validate:all"
```

**Team 2 - Dev Environment**
```bash
@agent-dev-environment
/skill dependency-audit /skill dev-environment-setup
"Phase 1: Run mise run deps:audit - identify 17+ tsup plugins
Phase 2: Fix with pnpm.overrides - esbuild, vite plugins
Phase 3: Create .env.development.local template
Phase 4: Update package.json scripts - pnpm dev launches all apps
Phase 5: Test with: mise run dev"
```

**Team 3 - Deployment**
```bash
@agent-deploy-orchestration
/skill github-actions-ci
"Phase 1: Create apps/dev-dashboard (React + Vite)
Phase 2: Integrate process orchestration (concurrently)
Phase 3: Create .github/workflows/build.yml (Turbo + caching)
Phase 4: Create .github/workflows/deploy.yml (staging/prod)
Phase 5: Test with: mise run ci && mise run deploy:staging"
```

**Team 4 - Infrastructure**
```bash
@agent-infrastructure
/skill mcp-builder-skill
"Phase 1: Add /health endpoints to each MCP server
Phase 2: Create health check aggregator
Phase 3: Setup error tracking & monitoring
Phase 4: Write OPERATIONS.md & troubleshooting guide
Phase 5: Test with: mise run health && mise run deploy:verify"
```

---

## Part 8: Quality Assurance & Testing

### Pre-Merge Checklist (per PR)

```bash
# All validations pass
mise run validate:all ✅

# Tests pass
mise run test:ci ✅

# Build succeeds
mise run build ✅

# No new security warnings
roborev review ✅

# Docs updated
git diff HEAD -- *.md | grep -q . ✅

# No dependency conflicts
mise run deps:check ✅
```

### Post-Integration Testing

```bash
# All repos at once
mise run dev
# Verify:
# ✅ ai-gateway at http://localhost:3000/mcp
# ✅ workers-builds at http://localhost:3001/mcp
# ✅ radar at http://localhost:3002/mcp
# ✅ dns-analytics at http://localhost:3003/mcp
# ✅ dev-dashboard at http://localhost:5173
# ✅ Logs visible in dashboard
# ✅ Ctrl+C stops all cleanly

# CI pipeline
mise run ci
# Verify:
# ✅ Lint passes
# ✅ Types check
# ✅ Tests pass
# ✅ Build succeeds
```

### Deployment Verification

```bash
# Staging
mise run deploy:staging
curl https://staging.ai-gateway.mcp.cloudflare.com/mcp/initialize | jq .

# Production
mise run deploy:prod
curl https://ai-gateway.mcp.cloudflare.com/mcp/initialize | jq .

# Verify command
mise run deploy:verify
```

---

## Part 9: Success Metrics

| Milestone | Metric | Target | Status |
|-----------|--------|--------|--------|
| **Week 1 Complete** | PR #1 + #2 merged | 2 PRs | 🔄 |
| **Build Setup** | All config centralized | oxlint, prettier, tsconfig unified | 🔄 |
| **Dev Setup** | `pnpm dev` works | All apps launch + dashboard | 🔄 |
| **CI/CD Ready** | GitHub Actions passing | Lint, type, test, build stages | 🔄 |
| **Deploy Ready** | Staging deployment works | Zero errors | 🔄 |
| **Week 2 Complete** | PR #3 + #4 merged | 2 PRs | 🔄 |
| **Production Ready** | Prod deployment works | Health checks pass | 🔄 |
| **Onboarding** | New dev setup time | < 5 minutes | 🔄 |

---

## Part 10: Resource Links & References

### Core Tools
- **Mise**: https://mise.jdx.dev/
- **Roborev**: https://roborev.io/
- **Awesome Copilot**: https://github.com/github/awesome-copilot
- **MCP Spec**: https://spec.modelcontextprotocol.io/

### Monorepo Tools
- **Turbo**: https://turbo.build/
- **pnpm Workspaces**: https://pnpm.io/workspaces
- **TypeScript**: https://www.typescriptlang.org/

### Cloudflare Stack
- **Workers**: https://developers.cloudflare.com/workers/
- **Wrangler**: https://developers.cloudflare.com/workers/wrangler/
- **OAuth Provider**: https://github.com/cloudflare/workers-oauth-provider

### Documentation
- **Root**: `mise.toml` - All tasks defined here
- **Skills**: `.agent/skills/mcp-builder-skill/SKILL.md` - MCP building guide
- **Setup**: `SETUP.md` - Getting started (auto-generated)
- **Dev**: `DEVELOPMENT.md` - Local development (auto-generated)
- **Operations**: `OPERATIONS.md` - Production runbook (auto-generated)

---

## Getting Started Now

```bash
# 1. Clone repo
git clone https://github.com/sjoerd2025/mcp-server-cloudflare.git
cd mcp-server-cloudflare

# 2. Install mise
curl https://mise.run | sh
eval "$(~/.local/bin/mise activate bash)"

# 3. Setup environment
mise run setup

# 4. Run health check
mise run health

# 5. Start development
mise run dev

# 6. In another terminal, dispatch teams:
@agent-build-config /skill typescript-config
"Consolidate TypeScript configs across monorepo"

# 7. Monitor progress
git log --oneline --graph --all  # See incoming PRs
```

---

**Status**: 🟢 Ready for Agent Dispatch  
**Created**: 2026-08-01  
**Tools**: Mise + Roborev + Awesome Copilot + GitHub Copilot  
**Target Completion**: 2 weeks (10 business days)
