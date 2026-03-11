# Relentless

Autonomous multi-agent orchestration for OpenCode, built on top of superpowers.

**Type `/unleash "build X"` and don't touch your keyboard until it's done.**

## Quick Start

```bash
bash ~/.config/opencode/relentless/install.sh
```

Restart OpenCode. Then:

```
/unleash "Build a REST API with user authentication"
```

## Commands

| Command | Description |
|---------|-------------|
| `/unleash "task"` | Full autonomous orchestration |
| `/pursuit` | Completion loop until 100% done |
| `/recon` | Generate/audit AGENTS.md files |
| `/resume` | Resume interrupted session |
| `/status` | Show current orchestration state |
| `/halt` | Stop all orchestration |
| `/halt clear` | Clear halt flag before /resume |

## Agents

| Agent | Model | Role |
|-------|-------|------|
| Conductor | Claude Opus | Orchestrator |
| Artisan | GPT-5.3 Codex | Deep coder |
| Maestro | GPT-5.3 Codex | UI/UX specialist |
| Sentinel | Claude Sonnet | Debugger/reviewer |
| Scout | zai-coding-plan/GLM-5 | Fast explorer |

## Configuration

Edit `~/.config/opencode/relentless.jsonc` to customize circuit breaker thresholds, pursuit iterations, and category routing.

For project-level overrides, create `.opencode/relentless.jsonc` in your project root.

## Spec & Plans

- Design spec: `docs/specs/2026-03-11-relentless-design.md`
- Implementation plan: `docs/plans/2026-03-11-relentless-implementation.md`
