#!/usr/bin/env bash
set -euo pipefail

RELENTLESS_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
OPENCODE_DIR="$HOME/.config/opencode"

echo "Installing Relentless..."
echo "Plugin root: $RELENTLESS_DIR"

# Create target directories if needed
mkdir -p "$OPENCODE_DIR/plugins"
mkdir -p "$OPENCODE_DIR/agents"
mkdir -p "$OPENCODE_DIR/commands"
mkdir -p "$OPENCODE_DIR/skills"

# Plugin registration
ln -sf "$RELENTLESS_DIR/.opencode/plugins/relentless.js" \
    "$OPENCODE_DIR/plugins/relentless.js"
echo "  [ok] Plugin: relentless.js"

# Agent registration
for agent in conductor artisan maestro sentinel scout; do
    ln -sf "$RELENTLESS_DIR/agents/$agent.md" \
        "$OPENCODE_DIR/agents/$agent.md"
    echo "  [ok] Agent: $agent"
done

# Command registration
for cmd in unleash pursuit recon resume status halt; do
    ln -sf "$RELENTLESS_DIR/commands/$cmd.md" \
        "$OPENCODE_DIR/commands/$cmd.md"
    echo "  [ok] Command: /$cmd"
done

# Skill registration (directory symlink)
ln -sf "$RELENTLESS_DIR/skills" \
    "$OPENCODE_DIR/skills/relentless"
echo "  [ok] Skills: relentless/*"

# Copy default config if not already present
if [ ! -f "$OPENCODE_DIR/relentless.jsonc" ]; then
    cp "$RELENTLESS_DIR/defaults.jsonc" "$OPENCODE_DIR/relentless.jsonc"
    echo "  [ok] Config: relentless.jsonc (copied from defaults)"
else
    echo "  [skip] Config: relentless.jsonc already exists"
fi

echo ""
echo "Relentless installed successfully."
echo "Restart OpenCode to activate."
