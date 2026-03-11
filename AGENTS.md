# Relentless Plugin

## Purpose
- Autonomous multi-agent orchestration plugin for OpenCode.
- Main entrypoint command is `/unleash "task"`.

## Stack
- Language: JavaScript (ES modules, `"type": "module"`)
- Runtime: Node.js / Bun
- Plugin SDK: `@opencode-ai/plugin@1.2.24`

## Common Commands
- Install plugin and links: `bash install.sh`
- Uninstall links: `bash uninstall.sh`
- There are no `package.json` scripts for build/test/dev.

## Important Directories
- `agents/` agent definitions and model assignments
- `commands/` slash-command wrappers (`/unleash`, `/recon`, etc.)
- `skills/` injected and on-demand skills
- `lib/` config/state/circuit-breaker runtime logic
- `docs/` specs and design notes

## Configuration
- Defaults from `defaults.jsonc`
- User override: `~/.config/opencode/relentless.jsonc`
- Project override: `.opencode/relentless.jsonc`
- Priority: project > user > defaults

## Runtime State
- State lives in `.relentless/` (project-local)
- `current-pursuit.json`: active orchestration state
- `halt`: created by `/halt`, checked before actions

## Non-Obvious Behaviors
- Uses JSONC parsing (comments and trailing commas tolerated)
- Loads some modules lazily with dynamic imports for resilience
- Session compaction hook preserves orchestration context
- Circuit breaker in `lib/circuit-breaker.js` prevents runaway loops
