#!/usr/bin/env bash
set -euo pipefail

# Dev-Standard Kit - One-liner Installer
# Usage: curl -fsSL https://raw.githubusercontent.com/brayancorrea-blip/dev-standard/main/install.sh | bash
# Or:    curl -fsSL https://raw.githubusercontent.com/brayancorrea-blip/dev-standard/main/install.sh | bash -s -- --target /path/to/repo

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; NC='\033[0m'

TARGET_DIR="."
UPGRADE=false
while [[ $# -gt 0 ]]; do
  case $1 in
    --target) TARGET_DIR="$2"; shift 2 ;;
    --upgrade) UPGRADE=true; shift ;;
    *) shift ;;
  esac
done

TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"

echo -e "${CYAN}Dev-Standard Kit Installer${NC}"
echo ""

# Prerequisites
command -v node >/dev/null 2>&1 || { echo -e "${RED}Error: Node.js required (v20+)${NC}"; exit 1; }
command -v git >/dev/null 2>&1 || { echo -e "${RED}Error: Git required${NC}"; exit 1; }

# Clone to temp dir
INSTALL_DIR=$(mktemp -d)
trap "rm -rf '$INSTALL_DIR'" EXIT

echo -e "Downloading dev-standard kit..."
git clone --depth 1 --quiet https://github.com/brayancorrea-blip/dev-standard.git "$INSTALL_DIR/dev-standard"

# Run setup
SETUP_ARGS=("--target" "$TARGET_DIR")
if [[ "$UPGRADE" == "true" ]]; then
  SETUP_ARGS+=("--upgrade")
fi

bash "$INSTALL_DIR/dev-standard/setup-dev-standard.sh" "${SETUP_ARGS[@]}" < /dev/null

echo ""
echo -e "${GREEN}Done! Open Claude Code in $TARGET_DIR to start.${NC}"
