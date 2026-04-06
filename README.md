# Dev-Standard Kit

Professional development standard based on **Ruflo** (SPARC + Hive Mind + Memory).

Works on **any repository** (Java, Node, Go, Python, Rust, .NET) with **zero configuration**.

## Quick Install

```bash
# Option 1: One-line install
curl -sL https://raw.githubusercontent.com/<org>/dev-standard/main/setup-dev-standard.sh | bash

# Option 2: Ruflo init + kit
npx ruflo@latest init --wizard
npx ruflo@latest init --hooks
```

## What it does

Every new feature follows the **SPARC** enforced flow:

1. **Specification** - PRD generated before any code
2. **Pseudocode** - Algorithm design validated
3. **Architecture** - Interfaces and contracts documented
4. **Refinement** - TDD implementation (Red-Green-Refactor)
5. **Completion** - Code review required before merge

## Components

- **18 specialized agents** (5 roles + 5 SPARC + 3 hive + 5 core)
- **10 hook points** enforcing quality gates
- **HNSW vector memory** for cross-session learning
- **Hive Mind** for team knowledge sharing
- **Auto-detection** of project type and framework

## Prerequisites

- Node.js 20+
- Claude Code CLI
- Git

## Structure

```
.mcp.json                    # Ruflo MCP server
.claude/
  settings.json              # Hooks configuration
  dev-standard.json          # Project-specific config
  agents/                    # 18 agent definitions
  helpers/                   # Hook handlers (0 deps)
  skills/                    # Unified workflow skill
  commands/                  # Slash commands
docs/.dev-standard/          # Team knowledge (committed)
```

## Upgrade

```bash
curl -sL https://raw.githubusercontent.com/<org>/dev-standard/main/setup-dev-standard.sh | bash -s -- --upgrade
```

Preserves customizations, updates managed files only.
