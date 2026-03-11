# Relentless

Autonomous multi-agent orchestration plugin for [OpenCode](https://opencode.ai), built on top of [superpowers](https://github.com/superpowers).

**Type `/unleash "build X"` and don't touch your keyboard until it's done.**

Relentless breaks complex tasks into specialized work, dispatches them to purpose-built agents, and loops until everything is 100% complete — tests passing, code reviewed, build green.

## What It Does

| Capability | Description |
|-----------|-------------|
| Autonomous deep work | `/unleash` plans, dispatches agents, and drives to completion |
| Multi-model orchestration | 5 specialized agents, each on the optimal model |
| Completion loop | `/pursuit` repeats until all criteria are met |
| Codebase mapping | `/recon` generates and audits `AGENTS.md` files |
| Session resilience | `/resume` picks up interrupted work from saved state |
| Runaway protection | 5-layer circuit breaker prevents infinite loops |

## Quick Start

```bash
# Install (creates symlinks, copies default config)
bash ~/.config/opencode/relentless/install.sh

# Restart OpenCode, then:
/unleash "Build a REST API with user authentication"
```

To uninstall:

```bash
bash ~/.config/opencode/relentless/uninstall.sh
```

## Commands

| Command | Description |
|---------|-------------|
| `/unleash "task"` | Full autonomous orchestration — plan, dispatch, pursue, validate |
| `/pursuit` | Completion loop until all todos are 100% done |
| `/recon` | Scan codebase and generate/audit `AGENTS.md` files |
| `/resume` | Resume an interrupted session from saved state |
| `/status` | Show current orchestration state and progress |
| `/halt` | Stop all orchestration immediately, save state |
| `/halt clear` | Clear the halt flag so `/resume` can proceed |

## Agents

Five specialized agents, each assigned to the model best suited for its role:

| Agent | Model | Role | Category |
|-------|-------|------|----------|
| **Conductor** | Claude Opus | Orchestrator — plans, delegates, validates. Never writes code. | `orchestrate` |
| **Artisan** | GPT-5.3 Codex | Deep coder — features, tests, refactoring. Goal-oriented. | `deep` |
| **Maestro** | GPT-5.3 Codex | UI/UX specialist — bold aesthetics, anti-generic design. | `visual` |
| **Sentinel** | Claude Sonnet | Quality guardian — debugging, code review, architecture. | `reason` |
| **Scout** | GLM-5 | Fast explorer — read-only reconnaissance and file search. | `quick` |

**Authority hierarchy:** Conductor > Sentinel > Artisan/Maestro > Scout

## Architecture

```
~/.config/opencode/relentless/
├── agents/           # Agent definitions and model assignments
│   ├── conductor.md
│   ├── artisan.md
│   ├── maestro.md
│   ├── sentinel.md
│   └── scout.md
├── commands/         # Slash-command wrappers
│   ├── unleash.md
│   ├── pursuit.md
│   ├── recon.md
│   ├── resume.md
│   ├── status.md
│   └── halt.md
├── skills/           # Injected and on-demand skills
│   ├── intent-gate/  # Analyze intent before acting
│   ├── todo-enforcer/# Stay on task, prevent scope creep
│   ├── pursuit/      # Completion loop logic
│   ├── unleash/      # Full orchestration pipeline
│   ├── recon/        # Codebase mapping workflows
│   └── ui-craft/     # 5-phase UI/UX design process
├── lib/              # Runtime logic
│   ├── config.js     # JSONC config loading and merge
│   ├── state.js      # .relentless/ state and halt management
│   └── circuit-breaker.js  # 5-layer runaway protection
├── defaults.jsonc    # Default configuration
├── install.sh        # Install symlinks and config
└── uninstall.sh      # Remove symlinks
```

### Runtime State

During orchestration, state lives in `.relentless/` (project-local):

- `current-pursuit.json` — Active plan, progress, agent assignments
- `halt` — Created by `/halt`, checked by all agents before every action

## How `/unleash` Works

```
1. IntentGate        → Classify intent, detect ambiguity
2. Conductor plans   → Brainstorm if complex, create structured plan
3. Scout recon       → Understand codebase structure and patterns
4. File ownership    → Pre-assign files per agent (no conflicts)
5. Parallel dispatch → Artisan, Maestro, Sentinel work concurrently
6. Pursuit loop      → Repeat until 100% (max 10 iterations)
7. Final validation  → Tests pass, build green, Sentinel sign-off
8. Report            → Summary of what was built
```

**Trivial tasks** (single file, < 20 lines) skip full orchestration and are handled directly.

## Circuit Breaker

Five independent layers prevent runaway loops:

| Layer | Protection | Action |
|-------|-----------|--------|
| 1. Error classification | Identifies token limit, rate limit, network errors | Token limits **never** retried |
| 2. Consecutive failures | Tracks failure streaks per session | 3 consecutive failures → STOP |
| 3. Injection rate limiter | Max 3 injections per 60-second window | Prevents flooding |
| 4. Token budget | Monitors context window usage | Stops at 85% capacity |
| 5. Dead session detection | Detects stalled sessions | Reports to user with recovery options |

## Configuration

Configuration uses JSONC (comments and trailing commas allowed).

**Merge priority:** project > user > defaults

| File | Scope |
|------|-------|
| `defaults.jsonc` | Built-in defaults (shipped with plugin) |
| `~/.config/opencode/relentless.jsonc` | User-level overrides |
| `.opencode/relentless.jsonc` | Project-level overrides |

### Configurable Settings

```jsonc
{
  // Category-to-agent routing
  "categories": {
    "deep": "artisan",
    "visual": "maestro",
    "quick": "scout",
    "reason": "sentinel",
    "orchestrate": "conductor"
  },

  // Circuit breaker thresholds
  "circuit_breaker": {
    "max_consecutive_failures": 3,
    "max_injections_per_minute": 3,
    "token_budget_threshold": 0.85
  },

  // Pursuit (completion loop) settings
  "pursuit": {
    "max_iterations": 10,
    "require_progress": true,
    "stall_limit": 2
  }
}
```

## Superpowers Integration

Relentless augments superpowers — it never overrides it. Agents invoke superpowers skills explicitly:

| Agent | Superpowers Skills Used |
|-------|------------------------|
| Conductor | brainstorming, writing-plans, verification-before-completion, requesting-code-review |
| Artisan | test-driven-development |
| Sentinel | systematic-debugging, verification-before-completion |
| Maestro | *(uses Relentless ui-craft skill instead)* |
| Scout | *(tasks too lightweight for skills)* |

During autonomous `/unleash` runs, Conductor acts as **proxy user** for superpowers approval checkpoints — no human intervention needed between task start and final report.

## Stack

- **Language:** JavaScript (ES modules)
- **Runtime:** Node.js / Bun
- **Plugin SDK:** `@opencode-ai/plugin`

## Design & Plans

- Design spec: [`docs/specs/2026-03-11-relentless-design.md`](docs/specs/2026-03-11-relentless-design.md)
- Implementation plan: [`docs/plans/2026-03-11-relentless-implementation.md`](docs/plans/2026-03-11-relentless-implementation.md)
