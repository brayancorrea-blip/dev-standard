## Dev-Standard

This project uses the Dev-Standard Kit (SPARC + Ruflo + Hive Mind).

### Development Flow
Every feature follows SPARC:
1. **Specification** - Create PRD at docs/prd/<feature>.md
2. **Pseudocode** - Design algorithms
3. **Architecture** - Define interfaces at docs/architecture/<feature>.md
4. **Refinement** - Implement with TDD (Red-Green-Refactor)
5. **Completion** - Review at docs/review/<feature>.md

### Quick Commands
- `/dev-standard:init` - Initialize project
- `/dev-standard:status` - Check gates status
- `npx ruflo sparc pipeline "feature"` - Full SPARC pipeline
- `npx ruflo memory search "query"` - Search team knowledge

### Quality Gates
Configured in .claude/dev-standard.json. Gates: warn (advisory) or block (enforced).
Completion gate is always BLOCK - no merge without review.

### Agents
18 specialized agents organized in 4 groups:
- **Roles** (5): product-manager, architect, engineer, qa-engineer, tech-reviewer
- **SPARC** (5): specification, pseudocode, architecture, refinement, completion
- **Hive Mind** (3): consensus-coordinator, knowledge-synthesizer, decision-arbiter
- **Core** (5): planner, coder, tester, researcher, reviewer

### Memory Stack
1. This CLAUDE.md (static, committed)
2. docs/.dev-standard/*.md (team knowledge, committed)
3. Ruflo HNSW memory (cross-session, local)
