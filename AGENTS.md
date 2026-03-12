# Relentless Plugin

## Purpose
- Autonomous multi-agent orchestration plugin for OpenCode.
- Main entrypoint command is `/unleash "task"`.

## Stack
- Language: TypeScript (ES modules, `"type": "module"`)
- Runtime: Node.js / Bun

## Common Commands
- Build TypeScript: `npm run build`
- Run tests: `npm test`

## Important Directories
- `agents/` agent definitions and model assignments
- `commands/` slash-command wrappers (`/unleash`, `/recon`, etc.)
- `skills/` injected and on-demand skills
- `lib/` runtime modules (config, state, circuit-breaker, shared-context, token-budget, compaction, doc-tracker, lessons)
- `.opencode/` plugin build directory — `plugins/relentless.ts` is the main entrypoint

## Configuration
- Defaults from `defaults.jsonc`
- User override: `~/.config/opencode/relentless.jsonc`
- Project override: `.opencode/relentless.jsonc`
- Priority: project > user > defaults

## Runtime State
- State lives in `.relentless/` (project-local)
- `current-pursuit.json`: active orchestration state
- `halt`: created by `/halt`, checked before actions
