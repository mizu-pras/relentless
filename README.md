# Relentless

Autonomous multi-agent orchestration plugin for [OpenCode](https://opencode.ai), now a fully self-contained orchestration system.

**Type `/unleash "build X"` and don't touch your keyboard until it's done.**

Relentless breaks complex tasks into specialized work, dispatches them to purpose-built agents, and loops until everything is 100% complete — tests passing, code reviewed, build green.

## What It Does

| Capability | Description |
|-----------|-------------|
| Autonomous deep work | `/unleash` plans, dispatches agents, and drives to completion |
| Multi-model orchestration | 6 specialized agents, each on the optimal model |
| Completion loop | `/pursuit` repeats until all criteria are met |
| Chunk verification | Intermediate build+test gates between implementation chunks |
| Codebase mapping | `/recon` generates and audits `AGENTS.md` files |
| Session resilience | `/resume` picks up interrupted work from saved state |
| Runaway protection | 5-layer circuit breaker prevents infinite loops |
| Framework gotcha learning | Persistent lessons system recognizes recurring build/framework patterns |

## Quick Start

```bash
# Install (builds TypeScript, creates symlinks, copies default config)
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

Six specialized agents, each assigned to the model best suited for its role:

| Agent | Model | Role | Category |
|-------|-------|------|----------|
| **Conductor** | Claude Opus | Orchestrator — plans, delegates, validates. Never writes code. | `orchestrate` |
| **Artisan** | GPT-5.3 Codex | Deep coder — features, tests, refactoring. Goal-oriented. | `deep` |
| **Maestro** | GPT-5.3 Codex | UI/UX specialist — bold aesthetics, anti-generic design. | `visual` |
| **Sentinel** | Claude Sonnet | Quality guardian — debugging, code review, architecture. | `reason` |
| **Scout** | zai-coding-plan/GLM-5 | Fast explorer — read-only reconnaissance and file search. | `quick` |
| **Code Reviewer** | Inherited | Senior reviewer — validates completed steps against plans and standards. | on-demand |

**Authority hierarchy:** Conductor > Sentinel > Artisan/Maestro > Scout

## Architecture

```
~/.config/opencode/relentless/
├── .opencode/            # Plugin SDK integration
│   ├── dist/             # Compiled plugin entry point
│   ├── plugins/          # Plugin source
│   ├── package.json      # Plugin dependencies (@opencode-ai/plugin@1.2.24)
│   └── tsconfig.json
├── agents/               # Agent definitions and model assignments
│   ├── AGENTS.md
│   ├── conductor.md
│   ├── artisan.md
│   ├── maestro.md
│   ├── sentinel.md
│   ├── scout.md
│   └── code-reviewer.md
├── commands/             # Slash-command wrappers
│   ├── AGENTS.md
│   ├── unleash.md
│   ├── pursuit.md
│   ├── recon.md
│   ├── resume.md
│   ├── status.md
│   └── halt.md
├── skills/               # Injected and on-demand relentless skills
│   ├── AGENTS.md
│   ├── intent-gate/                 # Analyze intent before acting
│   ├── todo-enforcer/               # Stay on task, prevent scope creep
│   ├── using-relentless/            # Session bootstrap behavior
│   ├── pursuit/                     # Completion loop logic
│   ├── unleash/                     # Full orchestration pipeline
│   ├── recon/                       # Codebase mapping workflows
│   ├── chunk-gate/                  # Intermediate build+test verification
│   ├── ui-craft/                    # 5-phase UI/UX design process
│   ├── brainstorming/               # Design exploration before implementation
│   ├── writing-plans/               # Structured implementation planning
│   ├── test-driven-development/     # TDD workflow enforcement
│   ├── systematic-debugging/        # Root-cause investigation workflow
│   ├── verification-before-completion/ # Completion verification gates
│   ├── requesting-code-review/      # Review dispatch workflow
│   ├── receiving-code-review/       # Review feedback handling workflow
│   ├── finishing-a-development-branch/ # Branch completion workflow
│   ├── using-git-worktrees/         # Isolated feature workspace setup
│   └── writing-skills/              # Skill authoring meta-workflow
├── lib/                  # Runtime logic (TypeScript)
│   ├── AGENTS.md
│   ├── config.ts         # JSONC config loading and merge
│   ├── state.ts          # .relentless/ state and halt management
│   ├── circuit-breaker.ts     # 5-layer runaway protection
│   ├── shared-context.ts      # Cross-agent context sharing + compression metrics
│   ├── token-budget.ts        # Proactive token budget forecasting
│   ├── compaction.ts          # Differential compaction for long pursuits
│   ├── doc-tracker.ts         # Documentation dirty-tracking
│   ├── lessons.ts             # Persistent learning system + framework gotcha database
│   ├── *.test.ts              # Unit tests for each module
│   ├── tsconfig.json
│   └── dist/             # Compiled JavaScript output
├── docs/                 # Specs and design notes
│   ├── specs/
│   └── plans/
├── defaults.jsonc        # Default configuration
├── install.sh            # Build + install symlinks and config
└── uninstall.sh          # Remove symlinks
```

### Runtime State

During orchestration, state lives in `.relentless/` (project-local):

- `current-pursuit.json` — Active plan, progress, agent assignments
- `halt` — Created by `/halt`, checked by all agents before every action
- `agent-assignments.json` — File ownership tracking per agent
- `lessons.jsonl` — Persistent lessons across pursuits (survives archive)
- `shared-context/` — Cross-agent knowledge base (cleared on archive):
  - `project-map.md` — Codebase structure from Scout
  - `conventions.md` — Detected coding patterns
  - `decisions.jsonl` — Architectural decisions log
  - `error-log.jsonl` — Errors and resolutions
  - `file-summaries.jsonl` — Per-file summaries for handoff compression
  - `doc-dirty.jsonl` — Documentation dirty-tracking

## How `/unleash` Works

```
 1. IntentGate           → Classify intent, detect ambiguity
 2. Conductor plans      → Brainstorm if complex, create structured plan
 3. Scout recon          → Understand codebase, verify deps, check imports, scan gotchas
 4. File ownership       → Pre-assign files per agent (no conflicts)
 4b. Parallel analysis   → Analyze dependency graph, identify parallel tracks
 5. Parallel dispatch    → Artisan, Maestro, Sentinel work concurrently
 6. Pursuit loop         → Repeat until 100%, chunk-gate between phases
 7. Final validation     → Tests pass, build green, Sentinel sign-off (MANDATORY)
 8. Report               → Summary of what was built
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
  },

  // Recon (codebase mapping) settings
  "recon": {
    "max_depth": 4,
    "include_env_vars": true,
    "include_dependencies": true
  },

  // Chunk gate verification commands
  "chunk_gate": {
    "enabled": true,
    "gate_commands": ["tsc --noEmit", "npm run build", "npm test"]
  },

  // Time budget allocation targets
  "time_budget": {
    "target_feature_ratio": 0.60,
    "max_fix_ratio": 0.20,
    "consecutive_fix_alert": 3
  },

  // Agent learning system
  "lessons": {
    "enabled": true,
    "max_lessons_in_context": 10,
    "max_lessons_in_handoff": 5
  }
}
```

## Skills

Relentless is self-contained and ships with both core orchestration skills and built-in workflow skills:

| Category | Skills |
|----------|--------|
| Core orchestration | intent-gate, todo-enforcer, using-relentless, pursuit, unleash, recon, chunk-gate, ui-craft |
| Workflow | brainstorming, writing-plans, test-driven-development, systematic-debugging, verification-before-completion, requesting-code-review, receiving-code-review, finishing-a-development-branch, using-git-worktrees, writing-skills |

During autonomous `/unleash` runs, Conductor acts as **proxy user** for skill approval checkpoints — no human intervention needed between task start and final report.

## Attribution

Workflow skills are forked from [superpowers](https://github.com/obra/superpowers) by Jesse Vincent, licensed under MIT.

## Stack

- **Language:** TypeScript (ES modules, `"type": "module"`)
- **Runtime:** Node.js / Bun
- **Plugin SDK:** `@opencode-ai/plugin@1.2.24`
- **Build:** `tsc` (TypeScript compiler)
- **Tests:** `npm test` (compiles and runs `*.test.ts` files)

## Design & Plans

- Design spec: [`docs/specs/2026-03-11-relentless-design.md`](docs/specs/2026-03-11-relentless-design.md)
- Implementation plan: [`docs/plans/2026-03-11-relentless-implementation.md`](docs/plans/2026-03-11-relentless-implementation.md)
