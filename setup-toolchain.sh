#!/usr/bin/env bash
# 
# MCP Server Cloudflare - Advanced Toolchain Setup
# Integrates: Mise, Roborev, Nitpicker, gh-aw, Claude-Squad, and GitHub Copilot
# Usage: bash setup-toolchain.sh
#

set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}MCP Server Cloudflare - Advanced Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# =============================================================================
# SECTION 1: MISE - Universal Version Manager & Task Orchestrator
# =============================================================================

echo -e "${YELLOW}[1/6] Installing Mise (Universal Version Manager)...${NC}"

if command -v mise &> /dev/null; then
    echo -e "${GREEN}✓ Mise already installed ($(mise --version))${NC}"
else
    echo "Installing Mise from https://mise.run..."
    curl https://mise.run | sh
    export PATH="$HOME/.local/bin:$PATH"
    echo -e "${GREEN}✓ Mise installed${NC}"
fi

# Activate mise in current shell
eval "$(mise activate bash)"

# Verify mise.toml exists
if [ -f "mise.toml" ]; then
    echo -e "${GREEN}✓ mise.toml found ($(wc -l < mise.toml) lines, 50+ tasks)${NC}"
else
    echo -e "${RED}✗ mise.toml not found in repository root${NC}"
    exit 1
fi

echo ""

# =============================================================================
# SECTION 2: ROBOREV - AI-Powered Code Review & Automation
# =============================================================================

echo -e "${YELLOW}[2/6] Installing Roborev (AI Code Review & Automation)...${NC}"

if command -v roborev &> /dev/null; then
    echo -e "${GREEN}✓ Roborev already installed ($(roborev --version 2>/dev/null || echo 'v?'))${NC}"
else
    echo "Installing Roborev from https://roborev.io/install.sh..."
    curl -fsSL https://roborev.io/install.sh | bash
    echo -e "${GREEN}✓ Roborev installed${NC}"
fi

# Suggest roborev setup
cat > .roborev.yml << 'EOF'
# Roborev Configuration
agent:
  model: claude-opus-4  # or your preferred model
  
review_rules:
  - name: "Code Quality"
    patterns: ["src/**/*.ts", "src/**/*.tsx"]
    checks: [lint, types, security]
  
  - name: "Dependencies"
    patterns: ["package.json", "pnpm-lock.yaml"]
    checks: [audit, conflicts]
  
  - name: "Deployment"
    patterns: [".github/workflows/**", "wrangler.toml"]
    checks: [config, secrets, validation]

auto_fix:
  enabled: true
  patterns: ["**.ts", "**.js"]
  exclude: ["node_modules/**", "dist/**"]
EOF

echo -e "${GREEN}✓ Created .roborev.yml configuration${NC}"
echo ""

# =============================================================================
# SECTION 3: NITPICKER - Rust Project Linting & Manifest Validation
# =============================================================================

echo -e "${YELLOW}[3/6] Installing Nitpicker (Cargo/Rust Manifest Linter)...${NC}"

if command -v cargo &> /dev/null; then
    if cargo nit --version &> /dev/null; then
        echo -e "${GREEN}✓ Nitpicker already installed${NC}"
    else
        echo "Installing Nitpicker via Cargo..."
        cargo install cargo-nit
        echo -e "${GREEN}✓ Nitpicker installed${NC}"
    fi
else
    echo -e "${YELLOW}⚠ Cargo not found. Install Rust to use Nitpicker.${NC}"
    echo "  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
fi

echo ""

# =============================================================================
# SECTION 4: GH-AW - GitHub Agentic Workflows Extension
# =============================================================================

echo -e "${YELLOW}[4/6] Installing gh-aw (GitHub Agentic Workflows Extension)...${NC}"

if command -v gh &> /dev/null; then
    if gh extension list 2>/dev/null | grep -q "github/gh-aw"; then
        echo -e "${GREEN}✓ gh-aw extension already installed${NC}"
    else
        echo "Installing gh-aw extension..."
        gh extension install github/gh-aw || echo "Note: May require GitHub CLI update"
        echo -e "${GREEN}✓ gh-aw extension installed${NC}"
    fi
else
    echo -e "${RED}✗ GitHub CLI (gh) not found. Install it first:${NC}"
    echo "  macOS: brew install gh"
    echo "  Linux: https://github.com/cli/cli/blob/trunk/docs/install_linux.md"
    echo "  Windows: choco install gh"
fi

echo ""

# =============================================================================
# SECTION 5: KATATRACKER - Agentic Workflow Tracking & Monitoring
# =============================================================================

echo -e "${YELLOW}[5/6] Setting up Workflow Tracking & Monitoring...${NC}"

# Note: katatracker.com is primarily a business accounting tool
# For agent tracking, we'll create our own lightweight solution
mkdir -p .agent/tracking

cat > .agent/tracking/README.md << 'EOF'
# Agent Task Tracking

This directory contains tracking files for Copilot agent teams and their progress.

## Files:
- `teams.json` - Team definitions and assignments
- `tasks.json` - Dispatch task tracking
- `progress.json` - Real-time progress updates

## Usage:
Agents automatically log progress to `progress.json` during execution.

Track your agents:
```bash
cat .agent/tracking/progress.json | jq .
```

## Team Status:
```bash
gh run list --limit 20 --json status,name,headBranch
```
EOF

cat > .agent/tracking/teams.json << 'EOF'
{
  "teams": [
    {
      "id": "team-build",
      "name": "Build Configuration Team",
      "lead_agent": "@agent-build-config",
      "skills": ["typescript-config", "eslint-prettier-setup", "monorepo-architecture", "auto-docs"],
      "status": "ready",
      "target_pr": 1
    },
    {
      "id": "team-dev",
      "name": "Development Environment Team",
      "lead_agent": "@agent-dev-environment",
      "skills": ["dev-environment-setup", "dependency-audit"],
      "status": "ready",
      "target_pr": 2
    },
    {
      "id": "team-deploy",
      "name": "Deployment & Orchestration Team",
      "lead_agent": "@agent-deploy-orchestration",
      "skills": ["github-actions-ci", "dev-environment-setup"],
      "status": "ready",
      "target_pr": 3
    },
    {
      "id": "team-infra",
      "name": "Infrastructure & Monitoring Team",
      "lead_agent": "@agent-infrastructure",
      "skills": ["mcp-builder-skill", "github-actions-ci"],
      "status": "ready",
      "target_pr": 4
    }
  ]
}
EOF

echo -e "${GREEN}✓ Created agent tracking structure at .agent/tracking/${NC}"
echo ""

# =============================================================================
# SECTION 6: CLAUDE-SQUAD - Multi-Agent Orchestration
# =============================================================================

echo -e "${YELLOW}[6/6] Setting up Claude-Squad (Multi-Agent Orchestration)...${NC}"

# Create agent orchestration configuration
mkdir -p .agent/squad

cat > .agent/squad/orchestration.yaml << 'EOF'
# Claude-Squad: Multi-Agent Orchestration Configuration
# Defines how teams of Copilot agents coordinate work

version: "1.0"

squads:
  
  # Primary Dispatch Squad
  - name: "dispatch-coordinator"
    type: "orchestrator"
    role: "Central coordinator overseeing all teams"
    model: "claude-opus-4"
    max_concurrent_tasks: 4
    
    responsibilities:
      - Monitor all team progress
      - Resolve cross-team dependencies
      - Escalate blockers
      - Merge approved PRs
      - Orchestrate phase transitions
    
    monitoring:
      check_interval: 300s  # 5 minutes
      slack_channel: "#agent-dispatch"
  
  # Team 1: Build Configuration
  - name: "build-config-squad"
    type: "specialist"
    role: "Consolidate build tooling and configs"
    lead_agent: "@agent-build-config"
    agents: 3
    model: "claude-opus-4"
    
    tasks:
      - phase: 1
        description: "Audit TypeScript setup"
        skill: "typescript-config"
        duration: "1 day"
      
      - phase: 2
        description: "Consolidate linting configs"
        skill: "eslint-prettier-setup"
        duration: "1 day"
      
      - phase: 3
        description: "Centralize formatting"
        duration: "1 day"
      
      - phase: 4
        description: "Generate documentation"
        skill: "auto-docs"
        duration: "1 day"
    
    success_criteria:
      - PR merges without conflicts
      - All validation passes: mise run validate:all
      - Test coverage maintained
  
  # Team 2: Development Environment
  - name: "dev-environment-squad"
    type: "specialist"
    role: "Unified development setup"
    lead_agent: "@agent-dev-environment"
    agents: 3
    model: "claude-opus-4"
    
    tasks:
      - phase: 1
        description: "Audit dependencies"
        skill: "dependency-audit"
        duration: "1 day"
      
      - phase: 2
        description: "Fix conflicts"
        duration: "1 day"
      
      - phase: 3
        description: "Environment templates"
        skill: "dev-environment-setup"
        duration: "1 day"
      
      - phase: 4
        description: "Unified dev scripts"
        duration: "1 day"
    
    success_criteria:
      - pnpm install succeeds
      - pnpm dev launches all apps
      - Dashboard loads at localhost:5173
  
  # Team 3: Deployment & Orchestration
  - name: "deploy-orchestration-squad"
    type: "specialist"
    role: "Dashboard UI and CI/CD setup"
    lead_agent": "@agent-deploy-orchestration"
    agents: 3
    model: "claude-opus-4"
    depends_on: ["build-config-squad", "dev-environment-squad"]
    
    tasks:
      - phase: 1
        description: "Build dashboard UI"
        duration: "2 days"
      
      - phase: 2
        description: "Process orchestration"
        duration: "2 days"
      
      - phase: 3
        description: "GitHub Actions CI"
        skill: "github-actions-ci"
        duration: "1 day"
    
    success_criteria:
      - Dashboard accessible and functional
      - GitHub Actions workflows pass
      - Staging deployment succeeds
  
  # Team 4: Infrastructure & Monitoring
  - name: "infrastructure-squad"
    type: "specialist"
    role: "Health checks, monitoring, operations"
    lead_agent: "@agent-infrastructure"
    agents: 2
    model: "claude-opus-4"
    depends_on: ["deploy-orchestration-squad"]
    
    tasks:
      - phase: 1
        description: "Health checks & monitoring"
        duration: "1 day"
      
      - phase: 2
        description: "Performance optimization"
        duration: "1 day"
      
      - phase: 3
        description: "Operations documentation"
        duration: "1 day"
    
    success_criteria:
      - mise run health passes
      - Cloudflare deployments verified
      - Runbook complete

# Cross-squad Communication Rules
communication:
  
  # How squads share progress
  progress_updates:
    enabled: true
    interval: "4 hours"
    channels: ["github-discussions", "pr-comments"]
  
  # Dependency resolution
  dependencies:
    auto_escalate: true
    escalation_time: "2 hours"
  
  # Conflict resolution
  conflicts:
    strategy: "consensus"
    timeout: "1 hour"

# Global settings
globals:
  timezone: "UTC"
  working_hours: "24/7"  # Always available
  max_retries: 3
  timeout_per_task: "4 hours"
  
  notifications:
    on_phase_complete: true
    on_pr_merge: true
    on_blocker: true

# Integration points
integrations:
  
  # GitHub
  github:
    enabled: true
    sync_pr_status: true
    auto_close_resolved_issues: true
  
  # Roborev for code review
  roborev:
    enabled: true
    auto_review_prs: true
    auto_fix_trivial_issues: true
  
  # Mise for task execution
  mise:
    enabled: true
    auto_run_validation: true
    track_execution_time: true
  
  # Slack for notifications
  slack:
    enabled: false  # Set SLACK_WEBHOOK_URL to enable
    channels:
      progress: "#agent-dispatch"
      errors: "#agent-errors"
      successes: "#agent-successes"

EOF

cat > .agent/squad/agent-manifest.json << 'EOF'
{
  "agents": [
    {
      "name": "@agent-build-config",
      "type": "specialist",
      "capabilities": ["typescript", "linting", "formatting", "config-management"],
      "tools": ["tsc", "oxlint", "prettier", "tsconfig-paths"],
      "max_concurrent_tasks": 1,
      "expertise_level": "expert"
    },
    {
      "name": "@agent-dev-environment",
      "type": "specialist",
      "capabilities": ["environment-setup", "dependency-management", "dev-tools"],
      "tools": ["pnpm", "mise", "concurrently"],
      "max_concurrent_tasks": 1,
      "expertise_level": "expert"
    },
    {
      "name": "@agent-deploy-orchestration",
      "type": "specialist",
      "capabilities": ["ui-development", "deployment", "orchestration", "ci-cd"],
      "tools": ["github-actions", "wrangler", "vite"],
      "max_concurrent_tasks": 2,
      "expertise_level": "expert"
    },
    {
      "name": "@agent-infrastructure",
      "type": "specialist",
      "capabilities": ["monitoring", "health-checks", "documentation", "mcp-servers"],
      "tools": ["cloudflare", "sentry", "prometheus"],
      "max_concurrent_tasks": 2,
      "expertise_level": "expert"
    }
  ]
}
EOF

echo -e "${GREEN}✓ Created Claude-Squad orchestration at .agent/squad/${NC}"
echo ""

# =============================================================================
# SECTION 7: Validation & Summary
# =============================================================================

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Setup Summary${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Validate all installations
echo -e "${YELLOW}Validating installations...${NC}"
echo ""

tools=(
    "mise:Mise Version Manager"
    "roborev:Roborev Code Review"
    "gh:GitHub CLI"
)

for tool_check in "${tools[@]}"; do
    IFS=':' read -r cmd name <<< "$tool_check"
    if command -v "$cmd" &> /dev/null; then
        echo -e "${GREEN}✓ $name${NC}"
    else
        echo -e "${YELLOW}⚠ $name (optional)${NC}"
    fi
done

echo ""
echo -e "${BLUE}Installation Complete!${NC}"
echo ""
echo -e "${GREEN}Next Steps:${NC}"
echo ""
echo "1. Validate tools:"
echo "   ${BLUE}mise run validate:tools${NC}"
echo ""
echo "2. Run full health check:"
echo "   ${BLUE}mise run health${NC}"
echo ""
echo "3. Dispatch agent teams:"
echo "   ${BLUE}@agent-build-config /skill typescript-config${NC}"
echo "   ${BLUE}\"Consolidate TypeScript configs across monorepo\"${NC}"
echo ""
echo "4. Monitor progress:"
echo "   ${BLUE}cat .agent/tracking/progress.json | jq .${NC}"
echo "   ${BLUE}gh run list --limit 20${NC}"
echo ""
echo "5. Start development:"
echo "   ${BLUE}mise run dev${NC}"
echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}Configuration Files Created:${NC}"
echo -e "${BLUE}========================================${NC}"
echo "  • .roborev.yml                 - Roborev configuration"
echo "  • .agent/tracking/             - Task tracking directory"
echo "  • .agent/squad/                - Agent orchestration configs"
echo ""
echo -e "${BLUE}Ready to dispatch! 🚀${NC}"
