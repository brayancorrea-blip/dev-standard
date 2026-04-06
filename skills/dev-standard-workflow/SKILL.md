---
name: dev-standard-workflow
description: Unified development workflow enforcing SPARC methodology with document-driven roles, quality gates, and ruflo memory integration
---

# Dev-Standard Workflow

Professional development standard that enforces a complete SPARC workflow with document-driven roles on every feature.

## Quick Start

```bash
# Initialize on any repo
npx ruflo@latest init --wizard
npx ruflo@latest init --hooks
```

## Development Flow

Every new feature follows this enforced chain:

### Phase 1: Specification
```bash
npx ruflo sparc run specification "feature description"
```
- Agent: planner (Product Manager role)
- Output: `docs/prd/<feature>.md`
- Gate: warn if PRD missing

### Phase 2: Pseudocode
```bash
npx ruflo sparc run pseudocode "feature description"
```
- Agent: architect
- Output: `docs/architecture/<feature>.md`
- Gate: warn if design missing

### Phase 3: Architecture
```bash
npx ruflo sparc run architecture "feature description"
```
- Agent: architect + consensus-coordinator
- Output: Interfaces and contracts documented
- Gate: warn if no interfaces

### Phase 4: Refinement (TDD)
```bash
npx ruflo sparc run tdd "feature description"
```
- Agents: coder + tester (Engineer + QA roles)
- Output: Code + tests (Red-Green-Refactor)
- Gate: block if tests fail
- Hook: pre-edit verifies test exists before source

### Phase 5: Completion
```bash
npx ruflo sparc run completion "feature description"
```
- Agent: reviewer (Tech Reviewer role)
- Output: `docs/review/<feature>.md`
- Gate: block - no merge without review

### Full Pipeline
```bash
npx ruflo sparc pipeline "feature description"
```

## Quality Gates

Configure in `.claude/dev-standard.json`:
- `warn` - Advisory message, allows proceeding
- `block` - Prevents proceeding until requirement met
- `off` - Gate disabled

Default: all phases `warn` except Completion which is `block`.

## Ruflo Memory Commands

```bash
npx ruflo memory store "key" "value"
npx ruflo memory search "query" --limit 5
npx ruflo memory recall "pattern/*"
```

## Hive Mind (Team Knowledge)

- Individual patterns: `.claude-flow/data/` (gitignored)
- Team knowledge: `docs/.dev-standard/` (committed)
- Decisions: `docs/.dev-standard/decisions.md`
- Patterns: `docs/.dev-standard/patterns.md`

## Swarm Orchestration

```bash
npx ruflo hive init --topology hierarchical --agents 5
npx ruflo orchestrate "complex task" --agents 5 --parallel
```

## MCP Tools (from Claude Code)

```
mcp__claude-flow__swarm_init({ topology: "hierarchical", maxAgents: 5 })
mcp__claude-flow__agent_spawn({ type: "architect" })
mcp__claude-flow__task_orchestrate({ task: "...", strategy: "parallel" })
mcp__claude-flow__memory_search({ query: "...", limit: 5 })
```
