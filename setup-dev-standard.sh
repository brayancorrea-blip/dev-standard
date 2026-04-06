#!/usr/bin/env bash
set -euo pipefail

# Dev-Standard Kit Installer
# Usage: setup-dev-standard.sh [--upgrade] [--target <path>]

VERSION="1.0.0"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Colors
RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; CYAN='\033[0;36m'; NC='\033[0m'

log()   { echo -e "${BLUE}[dev-standard]${NC} $1"; }
ok()    { echo -e "${GREEN}[OK]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC} $1"; }
err()   { echo -e "${RED}[ERROR]${NC} $1"; }
header(){ echo -e "\n${CYAN}=== $1 ===${NC}\n"; }

# timeout wrapper — macOS does not ship timeout by default
run_with_timeout() {
  local secs=$1; shift
  if command -v timeout >/dev/null 2>&1; then
    timeout "$secs" "$@"
  elif command -v gtimeout >/dev/null 2>&1; then
    gtimeout "$secs" "$@"
  else
    "$@"
  fi
}

# Parse args
UPGRADE=false
TARGET_DIR="."
while [[ $# -gt 0 ]]; do
  case $1 in
    --upgrade) UPGRADE=true; shift ;;
    --target) TARGET_DIR="$2"; shift 2 ;;
    -h|--help) echo "Usage: $0 [--upgrade] [--target <path>]"; exit 0 ;;
    *) err "Unknown option: $1"; exit 1 ;;
  esac
done

TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
CLAUDE_DIR="$TARGET_DIR/.claude"
LOCK_FILE="$CLAUDE_DIR/dev-standard.lock"

header "Dev-Standard Kit v${VERSION}"
log "Target: $TARGET_DIR"
log "Mode: $( [[ "$UPGRADE" == "true" ]] && echo "Upgrade" || echo "Fresh install" )"

# Check prerequisites
command -v node >/dev/null 2>&1 || { err "Node.js required (v20+)"; exit 1; }
command -v git >/dev/null 2>&1 || { err "Git required"; exit 1; }
command -v npx >/dev/null 2>&1 || { err "npx required (comes with Node.js)"; exit 1; }

NODE_VERSION=$(node -v | sed 's/v//' | cut -d. -f1)
if [[ "$NODE_VERSION" -lt 18 ]]; then
  warn "Node.js 20+ recommended (found v$NODE_VERSION)"
fi

# Install ruflo globally if not available
if ! npx ruflo@latest --version >/dev/null 2>&1; then
  log "Installing ruflo..."
  npm install -g ruflo@latest 2>/dev/null || npm install -g ruflo 2>/dev/null || true
  ok "Ruflo installed ($(npx ruflo@latest --version 2>/dev/null || echo 'latest'))"
else
  ok "Ruflo already installed ($(npx ruflo@latest --version 2>/dev/null))"
fi

# Checksum function
file_checksum() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | cut -d' ' -f1
  else
    shasum -a 256 "$1" | cut -d' ' -f1
  fi
}

# Check if file was modified by user (for upgrades)
is_user_modified() {
  local file="$1"
  local rel_path="${file#$TARGET_DIR/}"
  if [[ -f "$LOCK_FILE" ]] && grep -q "$rel_path" "$LOCK_FILE" 2>/dev/null; then
    local stored_hash=$(grep "$rel_path" "$LOCK_FILE" | cut -d'|' -f2)
    local current_hash=$(file_checksum "$file")
    [[ "$stored_hash" != "$current_hash" ]]
  else
    return 1
  fi
}

# Copy file with upgrade logic
install_file() {
  local src="$1"
  local dest="$2"
  local rel_path="${dest#$TARGET_DIR/}"

  if [[ -f "$dest" ]] && [[ "$UPGRADE" == "true" ]]; then
    if is_user_modified "$dest"; then
      cp "$src" "${dest}.upgrade-preview"
      warn "Modified: $rel_path (preview at ${rel_path}.upgrade-preview)"
      return
    fi
  fi

  mkdir -p "$(dirname "$dest")"
  cp "$src" "$dest"
  ok "Installed: $rel_path"
}

# ============================================================
header "Step 0: Ruflo pre-initialization"
# ============================================================

if command -v npx >/dev/null 2>&1; then
  log "Running ruflo init --force --start-all (base + daemon + memory + swarm)..."
  cd "$TARGET_DIR"
  if run_with_timeout 120 npx ruflo@latest init --force --start-all; then
    ok "Ruflo fully initialized (init + daemon + memory + swarm)"
  else
    warn "Ruflo pre-init failed or not available — continuing with local setup"
  fi
  cd - >/dev/null
else
  warn "npx not found — skipping ruflo pre-init"
fi

# ============================================================
header "Step 1: Creating directory structure"
# ============================================================

mkdir -p "$CLAUDE_DIR"/{agents/{roles,sparc,hive,core},helpers,skills/dev-standard-workflow,commands/dev-standard}
mkdir -p "$TARGET_DIR/docs/.dev-standard"
mkdir -p "$TARGET_DIR/docs/prd"
mkdir -p "$TARGET_DIR/docs/architecture"
mkdir -p "$TARGET_DIR/docs/review"
ok "Directory structure created"

# ============================================================
header "Step 2: Installing helpers (0 external deps)"
# ============================================================

for helper in hook-handler.cjs quality-gate.cjs project-detector.cjs router.js session.js memory.js auto-memory-hook.mjs; do
  if [[ -f "$SCRIPT_DIR/helpers/$helper" ]]; then
    install_file "$SCRIPT_DIR/helpers/$helper" "$CLAUDE_DIR/helpers/$helper"
  fi
done

# ============================================================
header "Step 3: Installing agents (18)"
# ============================================================

for dir in roles sparc hive core; do
  if [[ -d "$SCRIPT_DIR/agents/$dir" ]]; then
    for agent in "$SCRIPT_DIR/agents/$dir"/*.md; do
      [[ -f "$agent" ]] || continue
      install_file "$agent" "$CLAUDE_DIR/agents/$dir/$(basename "$agent")"
    done
  fi
done

AGENT_COUNT=$(find "$CLAUDE_DIR/agents" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')
ok "Installed $AGENT_COUNT agents"

# ============================================================
header "Step 4: Installing skills and commands"
# ============================================================

if [[ -f "$SCRIPT_DIR/skills/dev-standard-workflow/SKILL.md" ]]; then
  install_file "$SCRIPT_DIR/skills/dev-standard-workflow/SKILL.md" "$CLAUDE_DIR/skills/dev-standard-workflow/SKILL.md"
fi

for cmd in init.md status.md; do
  if [[ -f "$SCRIPT_DIR/commands/dev-standard/$cmd" ]]; then
    install_file "$SCRIPT_DIR/commands/dev-standard/$cmd" "$CLAUDE_DIR/commands/dev-standard/$cmd"
  fi
done

# ============================================================
header "Step 5: Configuring .mcp.json"
# ============================================================

MCP_FILE="$TARGET_DIR/.mcp.json"
if [[ "$UPGRADE" == "true" ]] && is_user_modified "$MCP_FILE" 2>/dev/null; then
  warn ".mcp.json user-modified — preserved. Update manually if needed."
else
  cat > "$MCP_FILE" << 'MCPEOF'
{
  "mcpServers": {
    "ruflo": {
      "command": "npx",
      "args": ["-y", "ruflo@latest", "mcp", "start"],
      "env": {
        "npm_config_update_notifier": "false",
        "CLAUDE_FLOW_LOG_LEVEL": "info",
        "CLAUDE_FLOW_MEMORY_BACKEND": "hybrid",
        "CLAUDE_FLOW_MEMORY_PATH": "./data/memory",
        "CLAUDE_FLOW_MCP_TRANSPORT": "stdio",
        "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1",
        "CLAUDE_FLOW_SPARC_ENABLED": "true",
        "CLAUDE_FLOW_SPARC_PHASES": "specification,pseudocode,architecture,refinement,completion",
        "CLAUDE_FLOW_HIVE_TOPOLOGY": "hierarchical",
        "CLAUDE_FLOW_HIVE_CONSENSUS": "raft",
        "CLAUDE_FLOW_MAX_AGENTS": "8"
      },
      "autoStart": true
    }
  }
}
MCPEOF
  ok "Created .mcp.json (ruflo@latest + SPARC/Hive env vars)"
fi

# ============================================================
header "Step 6: Configuring settings.json"
# ============================================================

SETTINGS_FILE="$CLAUDE_DIR/settings.json"
if [[ "$UPGRADE" == "true" ]] && is_user_modified "$SETTINGS_FILE" 2>/dev/null; then
  warn "settings.json user-modified — preserved. Update manually if needed."
else
  cat > "$SETTINGS_FILE" << 'SETTINGSEOF'
{
  "hooks": {
    "SessionStart": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/helpers/hook-handler.cjs session-restore"
          },
          {
            "type": "command",
            "command": "node .claude/helpers/auto-memory-hook.mjs import"
          }
        ]
      }
    ],
    "UserPromptSubmit": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/helpers/hook-handler.cjs route"
          }
        ]
      }
    ],
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/helpers/hook-handler.cjs pre-bash"
          }
        ]
      },
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/helpers/hook-handler.cjs pre-edit"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/helpers/hook-handler.cjs post-edit"
          }
        ]
      },
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/helpers/hook-handler.cjs post-bash"
          }
        ]
      }
    ],
    "Notification": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/helpers/hook-handler.cjs notify"
          }
        ]
      }
    ],
    "Stop": [
      {
        "matcher": "",
        "hooks": [
          {
            "type": "command",
            "command": "node .claude/helpers/hook-handler.cjs session-end"
          },
          {
            "type": "command",
            "command": "node .claude/helpers/auto-memory-hook.mjs sync"
          }
        ]
      }
    ]
  },
  "permissions": {
    "allow": [
      "Bash(node .claude/helpers/*)",
      "Read",
      "Glob",
      "Grep"
    ]
  }
}
SETTINGSEOF
  ok "Created settings.json with hooks (relative paths)"
fi

# ============================================================
header "Step 7: Detecting project and generating config"
# ============================================================

DETECTOR="$CLAUDE_DIR/helpers/project-detector.cjs"
if [[ -f "$DETECTOR" ]]; then
  cd "$TARGET_DIR"
  node "$DETECTOR" --init 2>/dev/null || warn "Project detection skipped"
  cd - >/dev/null
else
  warn "project-detector.cjs not found, skipping detection"
fi

# ============================================================
header "Step 8: Creating doc templates"
# ============================================================

for tmpl in knowledge-base decisions patterns; do
  src="$SCRIPT_DIR/docs/.dev-standard/${tmpl}.md"
  dest="$TARGET_DIR/docs/.dev-standard/${tmpl}.md"
  if [[ -f "$src" ]] && [[ ! -f "$dest" ]]; then
    install_file "$src" "$dest"
  fi
done

# ============================================================
header "Step 9: CLAUDE.md"
# ============================================================

CLAUDE_MD="$TARGET_DIR/CLAUDE.md"
DEV_STD_SECTION="## Dev-Standard

This project uses the Dev-Standard Kit (SPARC + Ruflo + Hive Mind).

### Development Flow
Every feature follows SPARC:
1. **Specification** - Create PRD at docs/prd/<feature>.md
2. **Pseudocode** - Design algorithms
3. **Architecture** - Define interfaces at docs/architecture/<feature>.md
4. **Refinement** - Implement with TDD (Red-Green-Refactor)
5. **Completion** - Review at docs/review/<feature>.md

### Quick Commands
- \`/dev-standard:init\` - Initialize project
- \`/dev-standard:status\` - Check gates status
- \`npx ruflo sparc pipeline \"feature\"\` - Full SPARC pipeline
- \`npx ruflo memory search \"query\"\` - Search team knowledge

### Quality Gates
Configured in .claude/dev-standard.json. Gates: warn (advisory) or block (enforced).
Completion gate is always BLOCK - no merge without review."

if [[ ! -f "$CLAUDE_MD" ]]; then
  echo "$DEV_STD_SECTION" > "$CLAUDE_MD"
  ok "Created CLAUDE.md"
else
  if ! grep -q "Dev-Standard" "$CLAUDE_MD" 2>/dev/null; then
    echo "" >> "$CLAUDE_MD"
    echo "$DEV_STD_SECTION" >> "$CLAUDE_MD"
    ok "Appended Dev-Standard section to CLAUDE.md"
  else
    ok "CLAUDE.md already has Dev-Standard section"
  fi
fi

# ============================================================
header "Step 10: Generating lock file"
# ============================================================

echo "# Dev-Standard Lock File (auto-generated)" > "$LOCK_FILE"
echo "# version=$VERSION" >> "$LOCK_FILE"
echo "# generated=$(date -u +%Y-%m-%dT%H:%M:%SZ)" >> "$LOCK_FILE"
echo "# rufloMinVersion=3.0.0" >> "$LOCK_FILE"
echo "" >> "$LOCK_FILE"

find "$CLAUDE_DIR" -type f \( -name "*.cjs" -o -name "*.js" -o -name "*.mjs" -o -name "*.md" -o -name "*.json" \) 2>/dev/null | sort | while read -r f; do
  rel="${f#$TARGET_DIR/}"
  hash=$(file_checksum "$f")
  echo "${rel}|${hash}" >> "$LOCK_FILE"
done

ok "Lock file generated"

# ============================================================
header "Step 11: Initializing Memory, Swarm & AgentDB"
# ============================================================

FLOW_DIR="$TARGET_DIR/.claude-flow"
INIT_TS="$(date -u +%Y-%m-%dT%H:%M:%SZ)"

mkdir -p "$FLOW_DIR"/{data,sessions,swarm}

# --- 1. Memory store ---
MEMORY_FILE="$FLOW_DIR/data/memory.json"
if [[ ! -f "$MEMORY_FILE" ]]; then
  cat > "$MEMORY_FILE" << MEMEOF
{
  "version": "1.0.0",
  "initialized": "${INIT_TS}",
  "entries": []
}
MEMEOF
  ok "Memory store initialized"
else
  ok "Memory store already exists (preserved)"
fi

# --- 2. AgentDB: register all agents ---
AGENTDB_FILE="$FLOW_DIR/data/agentdb.json"
if [[ ! -f "$AGENTDB_FILE" ]]; then
  REGISTERED_COUNT="$(find "$CLAUDE_DIR/agents" -name "*.md" 2>/dev/null | wc -l | tr -d ' ')"
  cat > "$AGENTDB_FILE" << AGENTEOF
{
  "version": "1.0.0",
  "initialized": "${INIT_TS}",
  "agents": [
    {"id": "coder",                 "type": "core",  "sparc_phase": "refinement",   "status": "ready", "model": "sonnet"},
    {"id": "tester",                "type": "core",  "sparc_phase": "refinement",   "status": "ready", "model": "sonnet"},
    {"id": "reviewer",              "type": "core",  "sparc_phase": "completion",   "status": "ready", "model": "sonnet"},
    {"id": "planner",               "type": "core",  "sparc_phase": "specification","status": "ready", "model": "sonnet"},
    {"id": "researcher",            "type": "core",  "sparc_phase": "all",          "status": "ready", "model": "sonnet"},
    {"id": "product-manager",       "type": "role",  "sparc_phase": "specification","status": "ready", "model": "sonnet"},
    {"id": "architect",             "type": "role",  "sparc_phase": "architecture", "status": "ready", "model": "sonnet"},
    {"id": "engineer",              "type": "role",  "sparc_phase": "refinement",   "status": "ready", "model": "sonnet"},
    {"id": "qa-engineer",           "type": "role",  "sparc_phase": "completion",   "status": "ready", "model": "sonnet"},
    {"id": "tech-reviewer",         "type": "role",  "sparc_phase": "completion",   "status": "ready", "model": "sonnet"},
    {"id": "specification",         "type": "sparc", "sparc_phase": "1",            "status": "ready", "model": "sonnet"},
    {"id": "pseudocode",            "type": "sparc", "sparc_phase": "2",            "status": "ready", "model": "sonnet"},
    {"id": "architecture",          "type": "sparc", "sparc_phase": "3",            "status": "ready", "model": "sonnet"},
    {"id": "refinement",            "type": "sparc", "sparc_phase": "4",            "status": "ready", "model": "sonnet"},
    {"id": "completion",            "type": "sparc", "sparc_phase": "5",            "status": "ready", "model": "sonnet"},
    {"id": "consensus-coordinator", "type": "hive",  "sparc_phase": "all",          "status": "ready", "model": "sonnet"},
    {"id": "decision-arbiter",      "type": "hive",  "sparc_phase": "all",          "status": "ready", "model": "sonnet"},
    {"id": "knowledge-synthesizer", "type": "hive",  "sparc_phase": "all",          "status": "ready", "model": "sonnet"}
  ]
}
AGENTEOF
  ok "AgentDB initialized (${REGISTERED_COUNT} agents registered, status: ready)"
else
  ok "AgentDB already exists (preserved)"
fi

# --- 3. Swarm config ---
SWARM_FILE="$FLOW_DIR/swarm/config.json"
if [[ ! -f "$SWARM_FILE" ]]; then
  cat > "$SWARM_FILE" << SWARMEOF
{
  "topology": "hierarchical",
  "maxAgents": 8,
  "memoryBackend": "hybrid",
  "initialized": "${INIT_TS}",
  "queen": "planner",
  "workers": ["coder", "tester", "reviewer", "researcher", "architect", "engineer", "qa-engineer"],
  "hive": ["consensus-coordinator", "decision-arbiter", "knowledge-synthesizer"],
  "routing": "automatic",
  "consensusThreshold": 0.66
}
SWARMEOF
  ok "Swarm initialized (hierarchical topology, queen=planner, 7 workers, 3 hive)"
else
  ok "Swarm config already exists (preserved)"
fi

# --- 4. .agents/config.toml (ruflo SPARC + Hive Mind config) ---
AGENTS_CONFIG="$TARGET_DIR/.agents/config.toml"
if [[ ! -f "$AGENTS_CONFIG" ]]; then
  mkdir -p "$TARGET_DIR/.agents/skills/sparc-methodology"
  if [[ -f "$SCRIPT_DIR/templates/config.toml" ]]; then
    cp "$SCRIPT_DIR/templates/config.toml" "$AGENTS_CONFIG"
    ok ".agents/config.toml created (SPARC + Hive Mind enabled)"
  fi
else
  ok ".agents/config.toml already exists (preserved)"
  mkdir -p "$TARGET_DIR/.agents/skills/sparc-methodology"
fi

# --- 5. Auto-memory store bootstrap ---
AUTO_MEMORY_FILE="$FLOW_DIR/data/auto-memory-store.json"
if [[ ! -f "$AUTO_MEMORY_FILE" ]]; then
  cat > "$AUTO_MEMORY_FILE" << AUTOEOF
[]
AUTOEOF
  ok "Auto-memory store bootstrapped"
fi

# --- 6. Ruflo subsystem verification ---
# Note: ruflo init --force --start-all already ran in Step 0
#       which auto-starts daemon, memory, and swarm
ok "Ruflo subsystems initialized via Step 0 (--start-all)"

ok "Memory + Swarm + AgentDB fully initialized"

# ============================================================
header "Setup Complete!"
# ============================================================

echo ""
log "Dev-Standard Kit v${VERSION} installed successfully."
echo ""
log "Next steps:"
echo "  1. Open Claude Code in this directory"
echo "  2. Ruflo MCP loads automatically from .mcp.json"
echo "  3. Start with: /dev-standard:status"
echo "  4. New feature: describe it and SPARC gates enforce the flow"
echo ""
log "Upgrade later: $0 --upgrade"
echo ""

# Add to .gitignore (create if missing)
GITIGNORE="$TARGET_DIR/.gitignore"
IGNORE_ENTRIES=(".claude-flow/" ".claude/settings.local.json" ".claude/memory.db" ".agents/data/" "data/memory")
touch "$GITIGNORE"
for entry in "${IGNORE_ENTRIES[@]}"; do
  if ! grep -qF "$entry" "$GITIGNORE" 2>/dev/null; then
    echo "$entry" >> "$GITIGNORE"
  fi
done
ok "Updated .gitignore"
