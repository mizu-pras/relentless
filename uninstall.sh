#!/usr/bin/env bash
set -euo pipefail

OPENCODE_DIR="$HOME/.config/opencode"

echo "Uninstalling Relentless..."

# Remove plugin
rm -f "$OPENCODE_DIR/plugins/relentless.js"
echo "  [ok] Removed: plugin"

# Remove agents
for agent in conductor artisan maestro sentinel scout code-reviewer; do
    rm -f "$OPENCODE_DIR/agents/$agent.md"
    echo "  [ok] Removed: agent $agent"
done

# Remove commands
for cmd in unleash pursuit recon resume status halt; do
    rm -f "$OPENCODE_DIR/commands/$cmd.md"
    echo "  [ok] Removed: command /$cmd"
done

# Remove skills symlink
rm -f "$OPENCODE_DIR/skills/relentless"
echo "  [ok] Removed: skills/relentless"

echo ""
echo "Relentless uninstalled. Config file ~/.config/opencode/relentless.jsonc preserved."
echo "Delete it manually if no longer needed."
