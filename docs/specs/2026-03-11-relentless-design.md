# Relentless: Autonomous Multi-Agent Orchestration Plugin for OpenCode

**Date:** 2026-03-11  
**Status:** Design Approved — Ready for Implementation  
**Author:** Design session with user

> **Migration Note (2026-03-11):** This design document was written when Relentless depended on superpowers as an external plugin. Superpowers workflow skills have since been forked and internalized into Relentless as built-in skills. All `superpowers:` namespace references in this document are historical — the live codebase uses `relentless:` exclusively.

> **Note on model IDs:** Model identifiers like `openai/gpt-5.3-codex` and `zai/glm-5` reflect what is currently configured in the user's `opencode.json`. These are user-specific — the plugin reads actual model IDs from `relentless/agents/*.md` frontmatter at runtime, not from hardcoded values. See Section 10.

---

## 1. Overview

Relentless is an OpenCode plugin that adds autonomous deep work, multi-model orchestration, and a relentless completion loop on top of superpowers.

**In one sentence:** Type `/unleash "build X"` and don't touch your keyboard until it's done.

### Core Principles

- **Relentless** — Does not stop until 100% complete
- **Superpowers-first** — Augments, never overrides superpowers
- **Model-optimal** — Right model for each type of work
- **Resilient** — 5-layer circuit breaker prevents runaway loops
- **Transparent** — User always knows what's happening

### What Relentless Adds (That Superpowers Doesn't Have)

| Capability | Superpowers | Relentless |
|-----------|-------------|------------|
| Autonomous deep work | No | Yes — `/unleash` |
| Multi-model orchestration | No | Yes — 5 agents |
| Completion loop | No | Yes — `/pursuit` |
| Codebase mapping | No | Yes — `/recon` |
| Session resume | No | Yes — `/resume` |
| UI/UX specialist | No | Yes — Maestro + ui-craft |
| Anti-infinite-loop | No | Yes — circuit breaker |
| Agent directory mapping | No | Yes — AGENTS.md hierarchy |

### What Relentless Does NOT Do

- Does not modify or override superpowers
- Does not add approval gates (that is OAC's domain)
- Does not publish to npm (personal use)
- Does not provide a UI or dashboard

---

## 2. Architecture

### 2.1 File Structure

```
~/.config/opencode/relentless/
├── .opencode/
│   └── plugins/
│       └── relentless.js           # Plugin entry point
├── agents/
│   ├── conductor.md                # Orchestrator (Claude Opus)
│   ├── artisan.md                  # Deep coder (GPT-5.3 Codex)
│   ├── maestro.md                  # UI/UX specialist (GPT-5.3 Codex)
│   ├── sentinel.md                 # Debugger/architect (Claude Sonnet)
│   └── scout.md                    # Fast explorer (GLM-5)
├── commands/
│   ├── unleash.md                  # /unleash — full orchestration
│   ├── pursuit.md                  # /pursuit — completion loop
│   ├── recon.md                    # /recon — codebase mapping
│   ├── resume.md                   # /resume — resume interrupted pursuit
│   ├── status.md                   # /status — dump orchestration state
│   └── halt.md                     # /halt — cascading abort
├── skills/
│   ├── intent-gate/
│   │   └── SKILL.md
│   ├── todo-enforcer/
│   │   └── SKILL.md
│   ├── pursuit/
│   │   └── SKILL.md
│   ├── unleash/
│   │   └── SKILL.md
│   ├── recon/
│   │   ├── SKILL.md
│   │   └── references/
│   │       ├── quality-criteria.md
│   │       └── templates.md
│   └── ui-craft/
│       ├── SKILL.md
│       └── references/
│           ├── aesthetic-directions.md
│           ├── typography-guide.md
│           └── anti-patterns.md
├── defaults.jsonc                  # Shipped default config (copied to relentless.jsonc on install)
└── docs/
    └── README.md
```

### 2.2 Install Procedure

Installation is performed by running the install script:

```bash
bash ~/.config/opencode/relentless/install.sh
```

The install script:
1. Creates `~/.config/opencode/agents/` if it doesn't exist
2. Creates `~/.config/opencode/commands/` if it doesn't exist
3. Creates all symlinks listed below
4. Copies `defaults.jsonc` → `~/.config/opencode/relentless.jsonc` (if not already present)
5. Prints a confirmation summary

To uninstall, run `bash ~/.config/opencode/relentless/uninstall.sh` which removes all symlinks.

### 2.3 Symlinks (Created During Install)

```bash
# Plugin registration
~/.config/opencode/plugins/relentless.js
  → ~/.config/opencode/relentless/.opencode/plugins/relentless.js

# Agent registration
~/.config/opencode/agents/conductor.md    → relentless/agents/conductor.md
~/.config/opencode/agents/artisan.md      → relentless/agents/artisan.md
~/.config/opencode/agents/maestro.md      → relentless/agents/maestro.md
~/.config/opencode/agents/sentinel.md     → relentless/agents/sentinel.md
~/.config/opencode/agents/scout.md        → relentless/agents/scout.md

# Command registration
~/.config/opencode/commands/unleash.md    → relentless/commands/unleash.md
~/.config/opencode/commands/pursuit.md    → relentless/commands/pursuit.md
~/.config/opencode/commands/recon.md      → relentless/commands/recon.md
~/.config/opencode/commands/resume.md     → relentless/commands/resume.md
~/.config/opencode/commands/status.md     → relentless/commands/status.md
~/.config/opencode/commands/halt.md       → relentless/commands/halt.md

# Skill registration (directory symlink)
~/.config/opencode/skills/relentless/     → relentless/skills/
```

### 2.4 Plugin Entry Point (relentless.js)

The plugin exports an ESM module using `@opencode-ai/plugin`. It provides:

```
Hooks registered by relentless.js:
├── experimental.chat.system.transform
│   → Inject IntentGate rules
│   → Inject Todo Enforcer rules
│   → Inject agent catalog (who does what)
│   → Inject authority hierarchy
├── experimental.session.compacting
│   → Preserve orchestration state before compaction
├── tool definitions (custom tools)
│   ├── relentless_unleash   → full orchestration logic
│   ├── relentless_pursuit   → completion loop logic
│   ├── relentless_recon     → codebase mapping logic
│   ├── relentless_resume    → resume from .relentless/
│   ├── relentless_status    → dump orchestration state
│   └── relentless_halt      → cascading abort + set halt flag
└── event handlers
    → Track session health (error counts, injection rate)
    → Snapshot state on session.idle / session.error
```

**Important:** The plugin appends to the system prompt — it does not replace superpowers' injection.

### 2.5 Config File

```
~/.config/opencode/relentless.jsonc     # User-level (global defaults)
.opencode/relentless.jsonc              # Project-level (overrides global)
```

**Config scope:** Only Relentless-specific settings. Model assignments live in agent `.md` files (single source of truth).

```jsonc
{
  // Category-to-agent routing (override defaults)
  "categories": {
    "deep": "artisan",
    "visual": "maestro",
    "quick": "scout",
    "reason": "sentinel",
    "orchestrate": "conductor"
  },

  // Circuit breaker settings
  "circuit_breaker": {
    "max_consecutive_failures": 3,
    "max_injections_per_minute": 3,
    "token_budget_threshold": 0.85
  },

  // Pursuit settings
  "pursuit": {
    "max_iterations": 10,
    "require_progress": true,
    "stall_limit": 2             // loops without progress before STOP (see Section 5.3)
  },

  // Recon settings
  "recon": {
    "max_depth": 4,
    "include_env_vars": true,
    "include_dependencies": true
  }
}
```

### 2.6 Session State Directory

Created per-project during first `/unleash`:

```
.relentless/
├── current-pursuit.json    # Active plan, current step, todo state
├── agent-assignments.json  # File ownership map per agent
├── halt                    # Exists if /halt was called (checked by all skills)
└── history/
    └── YYYY-MM-DDTHH-MM-SS-<task-slug>.json  # Completed pursuits (ISO date, colon replaced with hyphen)
```

### 2.7 Loading Order

```
OpenCode session start
  ↓
1. superpowers.js          → inject using-superpowers skill
2. relentless.js           → inject IntentGate + Todo Enforcer + agent catalog
  ↓
Both active simultaneously, no conflict (both append to system prompt)
```

---

## 3. Agents

### 3.1 Agent Roster

| Agent | Model | Role | Category |
|-------|-------|------|----------|
| **Conductor** | `anthropic/claude-opus-4-6` | Orchestrator. Plans, delegates, validates. Never writes code directly. | `orchestrate` |
| **Artisan** | `openai/gpt-5.3-codex` | Deep coder. Implements features, writes tests. Goal-oriented, not recipe-following. | `deep` |
| **Maestro** | `openai/gpt-5.3-codex` | UI/UX specialist. Designer-turned-developer. Bold aesthetics, anti-generic. | `visual` |
| **Sentinel** | `anthropic/claude-sonnet-4-6` | Debugger and architect. Root cause tracing, quality gate, code review. | `reason` |
| **Scout** | `zai/glm-5` | Fast explorer. Reconnaissance, file search, pattern detection. Read-only. | `quick` |

### 3.2 Agent Definitions

**Conductor** (`conductor.md`)
```yaml
---
name: conductor
model: anthropic/claude-opus-4-6
description: |
  Orchestrator for autonomous deep work sessions. Use when the user
  invokes /unleash or needs a multi-step task broken down and executed
  by specialized agents. Does NOT write code directly.
---
```

System prompt covers:
- Plans before dispatching
- Acts as proxy user for superpowers approval gates (brainstorming, writing-plans)
- Pre-assigns file ownership before parallel dispatch (prevent concurrent edits)
- Validates all subagent outputs before marking tasks complete
- Handles user interruptions gracefully ("User override detected. Pausing.")
- Reads `.relentless/halt` before every action
- Authority: final decision-maker on all disputes

**Artisan** (`artisan.md`)
```yaml
---
name: artisan
model: openai/gpt-5.3-codex
description: |
  Deep coder for complex implementation tasks. Use when Conductor
  delegates feature implementation, refactoring, or backend logic.
  Works from a plan, not step-by-step instructions.
---
```

System prompt covers:
- Only touches files assigned by Conductor
- If given a plan from Conductor, does NOT re-brainstorm
- Calls superpowers:test-driven-development during implementation
- Reads `.relentless/halt` before every action

**Maestro** (`maestro.md`)
```yaml
---
name: maestro
model: openai/gpt-5.3-codex
description: |
  UI/UX specialist with high aesthetic standards. Use when Conductor
  delegates tasks where the PRIMARY concern is visual appearance,
  layout, animation, or user experience with minimal business logic.
  For mixed tasks (logic + UI), prefer artisan with ui-craft skill.
---
```

System prompt covers:
- Loads `relentless:ui-craft` skill automatically
- Follows 5-phase design process (intent → aesthetic → visual system → motion → implement)
- Hard rules: no generic fonts, no purple gradients, no "AI slop" patterns
- Only touches files assigned by Conductor

**Sentinel** (`sentinel.md`)
```yaml
---
name: sentinel
model: anthropic/claude-sonnet-4-6
description: |
  Debugger and code quality guardian. Use when Conductor needs code
  reviewed, bugs traced, or architectural decisions made. Read-preferred
  but can edit when fixing bugs.
---
```

System prompt covers:
- Calls superpowers:systematic-debugging for root cause tracing
- Calls superpowers:verification-before-completion before signing off
- Reviews Artisan and Maestro outputs — Sentinel's findings take authority
- Reports to Conductor, never re-dispatches to other agents

**Scout** (`scout.md`)
```yaml
---
name: scout
model: zai/glm-5
description: |
  Fast codebase explorer. Use when Conductor needs quick reconnaissance:
  find files, detect patterns, understand project structure. Read-only.
  Never writes or edits files.
---
```

System prompt covers:
- Strictly read-only (glob, grep, read tools only)
- Returns structured findings to Conductor
- Optimized for speed — minimal system prompt, no heavy skills

### 3.3 Category Routing

Conductor picks a **category**, not a model directly:

| Category | Agent | When |
|----------|-------|------|
| `orchestrate` | Conductor | Planning, coordination, validation |
| `deep` | Artisan | Feature implementation, backend, refactoring |
| `visual` | Maestro | UI primary concern, layouts, animation |
| `quick` | Scout | File search, structure questions, recon |
| `reason` | Sentinel | Debugging, architecture decisions, reviews |

**Boundary rule (Artisan vs Maestro):**
- Maestro: task where the PRIMARY concern is visual/aesthetic/layout/animation
- Artisan: everything else, including tasks that have BOTH logic and UI
- When ambiguous: Artisan + load `relentless:ui-craft` skill

### 3.4 Authority Hierarchy

```
Conductor (final authority)
    └── Sentinel (code quality authority)
            └── Artisan / Maestro (implementation)
                    └── Scout (information only)
```

- Sentinel review findings override Artisan/Maestro preferences
- Conductor resolves all disputes
- No agent re-delegates upward in the hierarchy

### 3.5 Handoff Protocol

When Conductor dispatches any agent, the dispatch prompt must follow this schema:

```json
{
  "task": "Clear, specific goal statement",
  "context_files": ["src/api/users.ts", "src/lib/db.ts"],
  "assigned_files": ["src/api/users.ts"],
  "constraints": [
    "Skip brainstorming — plan already provided by Conductor",
    "Only touch assigned_files",
    "Stop and report if blocked"
  ],
  "expected_output": "Working implementation with passing tests",
  "related_todos": ["T-003", "T-004"],
  "approach": "tdd",
  "halt_flag_path": ".relentless/halt"
}
```

**Critical constraint:** All dispatches must include `"Skip brainstorming — plan already provided by Conductor"` to prevent double-brainstorming with superpowers.

---

## 4. Commands

### 4.1 Command Architecture

Commands are thin markdown wrappers that invoke custom tools defined by `relentless.js`. Orchestration logic lives in the tools, not the markdown.

```
/unleash "task"   →   relentless_unleash tool   →   full orchestration
/pursuit          →   relentless_pursuit tool   →   completion loop
/recon            →   relentless_recon tool     →   codebase mapping
/resume           →   relentless_resume tool    →   resume from state
/status           →   relentless_status tool    →   dump state
/halt             →   relentless_halt tool      →   cascading abort
```

### 4.2 /unleash

**Purpose:** Full autonomous orchestration. Activate all agents. Don't stop until done.

**Flow:**
```
1. IntentGate → classify intent, detect ambiguity, clarify if needed
   ↓
2. Conductor (Claude Opus) activates
   → Invokes superpowers:brainstorming if task is ambiguous/complex
   → Invokes superpowers:writing-plans to create structured plan
   → Saves plan to .relentless/current-pursuit.json
   ↓
3. Pre-flight validation
   → Check all required models exist in opencode.json
   → Warn and abort if critical model missing
   → Check .relentless/halt is not set
   ↓
4. Scout reconnaissance (parallel with planning if codebase unknown)
   ↓
5. Conductor pre-assigns file ownership per agent
   ↓
6. Parallel dispatch:
   ├── Artisan (GPT-5.3 Codex): backend/logic tasks
   ├── Maestro (GPT-5.3 Codex): UI/visual tasks (if any)
   └── Sentinel (Claude Sonnet): watching, ready to review
   ↓
7. Todo Enforcer active throughout
   ↓
8. Pursuit loop: if not 100% done, loop back to step 4 (max iterations)
   ↓
9. Final validation:
   → superpowers:verification-before-completion
   → superpowers:requesting-code-review
   → superpowers:finishing-a-development-branch
   ↓
10. Report to user: what was done, what remains (if any)
```

**Edge case — trivial task:**
If IntentGate classifies task as `trivial` (single file, < 20 lines), skip full orchestration. Conductor handles directly without dispatching subagents.

**Edge case — user interruption:**
If user sends a message during autonomous loop, Conductor responds: "Orchestration paused. [summary of current state]. What would you like to change?"

### 4.3 /pursuit

**Purpose:** Completion loop. Repeat until all todos are 100% done.

**Flow:**
```
1. Check todos exist → if none: "Nothing to pursue. Run /unleash first."
2. Check .relentless/halt → if set: "Halted. Run /halt clear to resume."
3. Loop:
   a. Identify incomplete todos
   b. Dispatch appropriate agents per category
   c. Mark todos completed
   d. Check completion criteria:
      - All todos completed
      - All tests pass (if applicable)
      - Build succeeds (if applicable)
      - Sentinel: no critical issues
   e. If complete → STOP, report success
   f. If not complete → check progress was made
      - No progress for 2 loops → STOP, report to user
4. Max 10 iterations (configurable)
```

### 4.4 /recon

**Purpose:** Scan codebase, generate/audit/improve AGENTS.md files hierarchically.

**Modes:**
```
/recon                  # Scan + generate new AGENTS.md files
/recon --audit          # Audit quality of existing AGENTS.md files
/recon --improve        # Audit + propose targeted improvements
/recon --update         # Update existing AGENTS.md based on recent changes
/recon --max-depth=N    # Limit directory depth (default: 4)
```

**Flow (generation mode):**
```
Phase 1: Discovery (Scout)
→ Scan directory tree up to max-depth
→ Find existing AGENTS.md files
→ Identify candidate directories (see significance criteria below)

Phase 2: Analysis (Scout + Conductor)
→ For each candidate directory:
  - Analyze files inside
  - Detect tech stack, patterns, conventions
  - Detect dependencies (package.json, requirements.txt, go.mod, Cargo.toml)
  - Detect environment variables (.env.example, config files)

Phase 3: Quality Assessment (--audit / --improve mode)
→ Score each existing AGENTS.md:
  | Criterion              | Weight |
  | Tech stack/conventions | High   |
  | Architecture clarity   | High   |
  | Commands/workflows     | High   |
  | Non-obvious patterns   | Medium |
  | Conciseness            | Medium |
  | Currency               | High   |

Grading: A(90-100) B(70-89) C(50-69) D(30-49) F(0-29)

Phase 4: Report
→ Print quality report before any changes
→ List files to be created/updated with diffs

Phase 5: User approval → Apply (Artisan)
→ Create/update AGENTS.md files
→ Preserve existing content structure
```

**Output structure:**
```
project/
├── AGENTS.md           ← Project-wide context
├── src/
│   ├── AGENTS.md       ← src-specific context
│   ├── components/
│   │   └── AGENTS.md   ← Component patterns
│   ├── api/
│   │   └── AGENTS.md   ← API conventions
│   └── lib/
│       └── AGENTS.md   ← Utility patterns
```

**Directory significance criteria:** A directory is a candidate for AGENTS.md if it meets ANY of:
- Contains 3+ source files (non-config, non-test)
- Contains files of mixed types/concerns (e.g., both `.ts` and `.sql`)
- Is a named domain directory (common names: `api`, `components`, `lib`, `services`, `utils`, `hooks`, `store`, `db`, `auth`, `models`)
- Already has an AGENTS.md (always include for audit)
- Is the project root (always include)

Directories that do NOT get AGENTS.md: `node_modules/`, `.git/`, `dist/`, `build/`, `coverage/`, `.next/`, hidden directories (starting with `.`) other than `.opencode/`.

**Edge case — empty project:** Report "No codebase found. Initialize your project first."

### 4.5 /resume

**Purpose:** Resume an interrupted `/pursuit` session.

**Flow:**
```
1. Check .relentless/halt → if set: "Halt flag is active. Run /halt clear before resuming."
2. Read .relentless/current-pursuit.json
3. If not found: "No interrupted pursuit found."
4. Reconstruct context: plan, current step, completed todos, file assignments
5. Present summary: "Resuming pursuit. Was on step X/Y. Completed: [list]."
6. Continue pursuit from last known state
```

### 4.6 /status

**Purpose:** Show current orchestration state.

**Data source:** All data is read from `.relentless/current-pursuit.json`. The state schema (Section 8.1) tracks `todos[].agent` for active assignments and `todos[].status` for progress. The `/status` tool reads this file and formats it for display.

**Output:**
```
## Relentless Status

Pursuit: active (loop 2/10)
Progress: 42% (3 of 7 todos complete)

Active assignments:
  Artisan    → T-004 (in_progress): Implement refresh token logic
  Sentinel   → T-003 (reviewing): JWT generation review

Pending todos:
  T-005: Write integration tests
  T-006: Update API documentation
  T-007: Final Sentinel review

Circuit breaker:
  Consecutive failures: 0/3
  Injections this minute: 1/3

Halt flag: not set
Last snapshot: 2026-03-11T14:32:07Z
```

### 4.7 /halt

**Purpose:** Cascading abort of all active orchestration.

**Modes:**
```
/halt           # Stop all orchestration, save state for resume
/halt clear     # Clear the halt flag so /resume can proceed
```

**Flow (`/halt`):**
```
1. Write .relentless/halt file (timestamp + reason)
2. All running skills check for halt flag before each action
3. Active agents receive "HALT detected. Stop immediately. Report state."
4. Conductor summarizes what was completed and what remains
5. State saved to .relentless/current-pursuit.json for /resume
```

**Flow (`/halt clear`):**
```
1. Delete .relentless/halt file
2. Confirm: "Halt flag cleared. Run /resume to continue."
```

To resume after halt: first run `/halt clear`, then `/resume`.

---

## 5. Skills

### 5.1 intent-gate

**Trigger:** Injected via system prompt — active on every message.

**Purpose:** Analyze intent before action. Prevent literal misinterpretation.

**Classification:**
- Intent types: `create`, `modify`, `delete`, `debug`, `explore`, `refactor`, `visual`, `trivial`
- If `trivial`: skip full orchestration, handle directly
- If ambiguous: ask user one clarifying question before proceeding
- If clear: proceed without delay

**Anti-patterns to detect:**
- Scope ambiguity ("all", "everywhere" without boundary)
- Destructive actions without confirmation ("delete", "remove", "clean")
- Instructions that could target wrong files

### 5.2 todo-enforcer

**Trigger:** Injected via system prompt — active for all agents.

**Rules:**
1. Before any action, check todo list
2. If a task is `in_progress`, complete it before starting another
3. Do not add scope outside the assigned todo items
4. If you discover necessary work not in todos, report to Conductor first
5. Check `.relentless/halt` before every action
6. If you deviate from assigned files, stop and ask Conductor

### 5.3 pursuit

**Skill invoked by:** `/pursuit` command and `/unleash` flow.

**Completion criteria (ALL must be true):**
1. All todo items are `completed`
2. All tests pass (if test suite exists)
3. Build succeeds (if build step exists)
4. Sentinel review: no critical issues

**Loop safety:**
- Max iterations: 10 (configurable)
- Progress required each loop (at least 1 todo completed)
- 2 loops without progress → STOP → report to user ("Stalled: no progress in 2 loops")
- Token budget check before each loop iteration

**Stall detection authority:** The pursuit skill's stall detector (2 loops without progress) is the primary stall mechanism. Circuit breaker Layer 5 (3 consecutive errors) is a separate, independent condition. Either can trigger a STOP independently — they do not conflict. If both fire simultaneously, the pursuit skill's message takes precedence as it has more context about task progress.

### 5.4 unleash

**Skill invoked by:** `/unleash` command.

**Meta-skill** that orchestrates the full pipeline:
1. IntentGate
2. Conductor planning (with superpowers)
3. Pre-flight validation
4. File ownership assignment
5. Parallel agent dispatch
6. Pursuit loop
7. Final validation (with superpowers)
8. Report

### 5.5 recon

See Section 4.4 for full flow.

**References included:**
- `references/quality-criteria.md` — detailed scoring rubrics per criterion
- `references/templates.md` — AGENTS.md templates by project type (Next.js, API, CLI, monorepo, etc.)

### 5.6 ui-craft

**Loaded by:** Maestro automatically. Can also be loaded by Artisan when task has visual component.

**5-Phase Design Process:**

**Phase 1: Design Intent**
- What is the purpose of this UI element?
- Who is the audience?
- What tone? (professional, playful, bold, minimal, etc.)
- What constraints? (mobile-first, existing design system, accessibility requirements)

**Phase 2: Aesthetic Direction**
Choose a bold direction — never generic:
- Brutalist, Maximalist, Retro-futuristic, Luxury minimalism, Playful organic
- If no direction specified, infer from existing codebase or propose 2-3 options

**Phase 3: Visual System**
- **Typography:** Choose distinctive fonts. Avoid Inter, Roboto, Arial unless justified.
- **Color:** Cohesive palette with sharp accent. Use OKLCH for perceptual consistency.
- **Spacing:** Establish visual rhythm, maintain it throughout.
- **Components:** Each component has personality, not generic box-with-border.

**Phase 4: Motion & Interaction**
- Purposeful micro-interactions (not gratuitous)
- Staggered reveals, scroll-triggered animations where appropriate
- Hover states that are surprising but not annoying
- Always respect `prefers-reduced-motion`

**Phase 5: Implementation**
- Semantic HTML
- Mobile-first responsive
- Accessibility: ARIA roles, keyboard navigation, contrast ratios (WCAG AA minimum)
- Performance: lazy loading, minimal DOM depth

**References:**
- `references/aesthetic-directions.md` — examples and guidance per aesthetic
- `references/typography-guide.md` — font pairings and rules
- `references/anti-patterns.md` — what to never do

**Hard prohibitions:**
```
NEVER:
- Generic sans-serif with no personality
- Purple gradient + white card ("AI website" look)
- shadow-md on every element
- Uniform border-radius everywhere
- Predictable stock-photo hero sections
- Animations with no purpose
- Cookie-cutter dashboard layouts
```

---

## 6. Circuit Breaker System

This is Relentless's defense against the OmO issue #2462 (infinite loop on token limit errors) and similar runaway behaviors. Five independent layers.

### Layer 1: Error Classification

Every error is classified before any retry decision:

| Error Type | Detection | Action | Retry? |
|-----------|-----------|--------|--------|
| Token limit / context_length_exceeded | Parse error message | **STOP TOTAL.** Compact or report to user. | Never |
| Rate limit (429) | HTTP status | Backoff: 2s → 4s → 8s | Yes, max 3x |
| Network / transient (503, 502) | HTTP status | Retry after 2s | Yes, max 3x |
| Model refused | Model-specific error | Log + report to user | Never |
| Abort / cancel (AbortError) | Error type check | Stop, clear state | Never |
| Unknown error | Fallthrough | Max 2 retries, then STOP | Limited |

**Critical rule:** Token limit errors are **never retried**. This is the root cause of OmO #2462.

### Layer 2: Consecutive Failure Circuit Breaker

Per-session failure tracking:

```
Failure 1 → retry after 2 seconds
Failure 2 → retry after 5 seconds
Failure 3 → STOP. Report to user with error details.
Same error type appearing 2x in a row → STOP immediately (don't wait for 3)
```

Resets on successful action.

### Layer 3: Injection Rate Limiter

```
Maximum: 3 continuation injections per 60-second window per session
If exceeded: circuit breaker activates → STOP → report to user
```

Prevents flooding even if error classification fails.

### Layer 4: Token Budget Awareness

Before each pursuit loop iteration and each continuation injection:

```
If context_usage > 85% of maxContext:
  → Do NOT inject
  → Attempt compaction (auto-compact is enabled in config)
  → After compaction, re-check context usage
  → If still > 85%: STOP → report to user

Config reference: compaction.threshold=0.7, maxContext=120000
Relentless threshold: 85% (above compaction threshold, below limit)
```

### Layer 5: Dead Session Detection

Session is marked "stalled" if:
- 3+ consecutive errors without a successful output
- Every model response is < 10 tokens (model cannot respond meaningfully)
- All retry attempts fail with identical errors

On stall detection:
1. Mark session as `stalled` in `.relentless/current-pursuit.json`
2. STOP all automated injection
3. Report to user: "Session stalled. Options: [compact] [new session] [manual continue]"
4. State is saved — `/resume` available after resolution

---

## 7. Superpowers Integration

### 7.1 Relationship

```
Superpowers:  workflow discipline   (HOW to work)
Relentless:   execution engine      (WHO works, WHEN, and ensures completion)
```

These systems complement each other. Relentless agents call superpowers skills explicitly. Superpowers has no knowledge of Relentless — it doesn't need to.

### 7.2 Skill Usage Per Agent

| Agent | Superpowers Skills Called |
|-------|--------------------------|
| Conductor | brainstorming, writing-plans, requesting-code-review, verification-before-completion, finishing-a-development-branch |
| Artisan | test-driven-development, subagent-driven-development |
| Maestro | (none — ui-craft is its own Relentless skill) |
| Sentinel | systematic-debugging, verification-before-completion |
| Scout | (none — tasks are too lightweight) |

### 7.3 Autonomy Model: Conductor as Proxy User

Superpowers skills include human-in-the-loop checkpoints. During autonomous `/unleash`, Conductor replaces the human at these checkpoints.

**Mechanism:** Superpowers skills are behavioral instructions injected into the system prompt — they tell the agent to pause and ask the user before proceeding. Conductor, as the orchestrating agent, satisfies these checkpoints itself rather than escalating to the human user.

Specifically:

| Superpowers Checkpoint | Conductor's Proxy Action |
|------------------------|--------------------------|
| `brainstorming`: "Present design, get user approval" | Conductor reviews the design itself using its Opus reasoning capability, then approves or revises. Conductor's approval is treated as sufficient. |
| `writing-plans`: "Review plan before implementation" | Conductor reads the plan, validates it against the original task intent, and approves. |
| `requesting-code-review`: Review before merge | Conductor dispatches Sentinel for review. Sentinel's sign-off is the approval. |
| `verification-before-completion`: Confirm it works | Conductor directs the test run and build check. Passing output is the approval. |

This works because Conductor's system prompt explicitly defines: *"You are acting as the project lead for this autonomous session. Approval checkpoints in superpowers skills are satisfied by your own review and judgment. You do not need to escalate to the human user for these checkpoints."*

**User approval happens at only 2 points:**
1. **Intent approval** — at `/unleash` invocation (user describes the task)
2. **Final review** — Conductor presents completed work for user sign-off

Everything in between is handled autonomously by Conductor.

### 7.4 Preventing Double Brainstorming

Superpowers injects "MUST brainstorm before creative work" into every agent's context. To prevent Artisan from re-brainstorming a plan that Conductor already created:

1. Every handoff from Conductor includes `"Skip brainstorming — plan already provided by Conductor"` in the constraints field
2. Each agent definition (artisan.md, maestro.md) explicitly states: "If you receive a plan from Conductor, do NOT invoke brainstorming"
3. The `approach` field in the handoff protocol signals to TDD skill: test-first is expected

### 7.5 Coexistence of system.transform Hooks

Both superpowers and Relentless use `experimental.chat.system.transform`. Both append to `output.system[]` — they do not overwrite. Load order:

1. superpowers.js → appends using-superpowers bootstrap
2. relentless.js → appends IntentGate + Todo Enforcer + agent catalog

Combined system prompt is larger but non-conflicting. Both plugins follow the append pattern.

---

## 8. Session Persistence & Compaction

### 8.1 State Snapshots

State is written to `.relentless/current-pursuit.json` at:
- Start of each pursuit loop iteration
- After each todo status change
- On `session.idle` event
- On `session.error` event (before error handling)

```json
{
  "version": 1,
  "started_at": "2026-03-11T14:00:00Z",
  "updated_at": "2026-03-11T14:32:07Z",
  "task": "Build user authentication with JWT",
  "plan_summary": "7-step plan: setup, models, JWT, routes, tests, docs, review",
  "current_loop": 2,
  "max_loops": 10,
  "todos": [
    { "id": "T-001", "subject": "Setup auth middleware", "status": "completed" },
    { "id": "T-002", "subject": "Create user model", "status": "completed" },
    { "id": "T-003", "subject": "Implement JWT generation", "status": "completed" },
    { "id": "T-004", "subject": "Add refresh token logic", "status": "in_progress", "agent": "artisan", "started_at": "2026-03-11T14:30:00Z" },
    { "id": "T-005", "subject": "Write integration tests", "status": "pending" },
    { "id": "T-006", "subject": "Update API documentation", "status": "pending" },
    { "id": "T-007", "subject": "Final Sentinel review", "status": "pending" }
  ],
  "agent_assignments": {
    "artisan": ["src/auth/jwt.ts", "src/auth/refresh.ts"],
    "sentinel": ["src/auth/middleware.ts"]
  },
  "circuit_breaker": {
    "consecutive_failures": 0,
    "injections_last_minute": 1,
    "stalled": false
  }
}
```

### 8.2 Compaction Hook

During session compaction, `relentless.js` injects critical orchestration state:

```javascript
"experimental.session.compacting": async (input, output) => {
  const state = readCurrentPursuit();
  if (!state) return;

  output.context.push(`
## Relentless Orchestration State (Preserved Through Compaction)
Task: ${state.task}
Progress: Loop ${state.current_loop}/${state.max_loops}
Completed: ${completedCount}/${totalCount} todos

Active assignments:
${formatAssignments(state.agent_assignments)}

Pending todos:
${formatPendingTodos(state.todos)}

Circuit breaker: ${state.circuit_breaker.consecutive_failures}/3 failures
Last updated: ${state.updated_at}

IMPORTANT: Continue the pursuit from the current state above.
Do not restart from the beginning.
  `);
}
```

---

## 9. Progress Reporting

### 9.1 TodoWrite as Progress Signal

Relentless updates todos aggressively. Since the TodoWrite tool output is visible in the OpenCode TUI, the user always sees progress naturally without needing separate notifications.

Milestone updates written to todos:
- Loop start: "Loop N/10 starting"
- Agent dispatch: "Artisan working on T-004"
- Agent complete: "T-004 complete (Artisan)"
- Review started: "Sentinel reviewing T-004"
- Loop complete: "Loop N complete — X/Y todos done"

### 9.2 /status Command

Available any time. Shows full orchestration state (see Section 4.6).

---

## 10. Model Configuration

### 10.1 Changing Agent Models

Models are defined in agent `.md` file frontmatter — single source of truth:

```yaml
# ~/.config/opencode/relentless/agents/artisan.md
---
name: artisan
model: openai/gpt-5.3-codex
---
```

To change Artisan's model, edit this file. Takes effect in the next session.

### 10.2 Model Fallback

Runtime model fallback chains are not supported by the OpenCode plugin API. Instead, Conductor handles agent failure gracefully at the orchestration level:

```
Artisan dispatch fails (API error):
  → Conductor retries Artisan once (might be transient)
  → If fails again → Conductor dispatches Sentinel as fallback coder
  → If Sentinel also fails → circuit breaker triggers → report to user
```

Fallback behavior is encoded in Conductor's system prompt, not the plugin.

### 10.3 Runtime Validation

At `/unleash` startup, the plugin reads `opencode.json` and validates:

```javascript
// Check each agent's model exists in provider config
const requiredModels = {
  conductor: "anthropic/claude-opus-4-6",
  artisan: "openai/gpt-5.3-codex",
  maestro: "openai/gpt-5.3-codex",
  sentinel: "anthropic/claude-sonnet-4-6",
  scout: "zai/glm-5"
};

// If model missing → warn user → offer to continue with fallback or abort
```

---

## 11. Priority Matrix for Implementation

**Implementation sequencing within tiers:** P0 items must be completed before P1. Within P0, implement in this order: plugin skeleton → agent definitions → system prompt injection → session persistence → compaction hook → circuit breaker. Within P1, implement skills before tool logic (tools invoke skills).

**Pre-implementation verification required:** Before writing any `/unleash` parallel dispatch logic, empirically verify Open Question #1 (parallel vs sequential dispatch). If sequential, the dispatch architecture in Section 4.2 step 6 must be revised to use sequential dispatch with progress interleaving instead.

| Feature | Priority | Complexity | Depends On | Notes |
|---------|----------|-----------|------------|-------|
| Plugin skeleton (relentless.js) | P0 | Low | — | Foundation for everything |
| Agent definitions (5 .md files) | P0 | Low | — | Agents + install script |
| Command wrappers (6 .md files) | P0 | Low | — | Thin wrappers only |
| System prompt injection | P0 | Low | Plugin skeleton | IntentGate + Todo Enforcer |
| Session persistence (.relentless/) | P0 | Medium | Plugin skeleton | Critical — required for /resume + compaction |
| Compaction hook | P0 | Medium | Session persistence | Critical — without this, state lost on compact |
| Circuit breaker (Layer 1+2) | P0 | Medium | Plugin skeleton | Error classification + failure tracking |
| Skills (intent-gate, todo-enforcer) | P1 | Medium | System prompt injection | Injected automatically, must exist first |
| Skills (pursuit, unleash) | P1 | Medium | intent-gate, todo-enforcer | On-demand skills |
| ui-craft skill | P1 | Medium | — | Maestro's core, independent |
| Circuit breaker (Layer 3+4+5) | P1 | Medium | Layer 1+2 | Rate limiter + token budget + dead session. Layer 4 implementation depends on OQ #2. |
| /unleash tool logic | P1 | High | All P0 + skills | Verify parallel dispatch first |
| /pursuit tool logic | P1 | Medium | pursuit skill | Core feature |
| /recon tool logic | P1 | High | scout agent + recon skill | High value |
| recon skill + references | P2 | Medium | /recon tool | Quality rubric, templates |
| /resume tool logic | P2 | Medium | Session persistence | Quality of life |
| /status + /halt tools | P2 | Low | Session persistence | Quality of life |
| Runtime validation | P2 | Low | Plugin skeleton | Safety check at /unleash startup |
| relentless.jsonc config loading | P2 | Low | Plugin skeleton | Customization |
| ui-craft references | P3 | Low | ui-craft skill | Enhancement |
| Completed pursuit history | P3 | Low | Session persistence | Nice to have |

---

## 12. Risks & Mitigations

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Infinite loop (OmO #2462 pattern) | Low | Critical | 5-layer circuit breaker, especially Layer 1 |
| State lost during compaction | Medium | High | experimental.session.compacting hook + file persistence |
| Artisan/Maestro edit same file | Low | Medium | Conductor pre-assigns file ownership before parallel dispatch |
| Double brainstorming | High | Medium | Explicit constraint in all handoffs: "Skip brainstorming" |
| Model API outage | Low | Medium | Conductor-level retry + graceful report to user |
| Scout (GLM-5) unreliable multi-step | Medium | Low | Scout tasks are simple (glob/grep/read) — minimal risk |
| Token cost runaway | Low | Medium | Circuit breaker Layer 3+4, Scout for cheap recon |
| User confusion during autonomous run | Medium | Low | Aggressive TodoWrite updates + /status command |
| Superpowers system.transform conflict | Very Low | Low | Both append — technically non-conflicting |
| OpenCode experimental API changes | Low | Medium | Accept risk — same exposure as superpowers |

---

## 13. Non-Goals (Explicitly Out of Scope)

- Approval gates on every action (that is OAC's philosophy, not Relentless)
- Publishing to npm or as a marketplace plugin
- Web UI or dashboard
- Multi-user / team synchronization
- Cost tracking / billing integration
- Support for OpenCode versions below current (1.2.24)
- True background agent execution (fire-and-forget, poll later)

---

## 14. Open Questions (Must Resolve Before Implementation)

These are not optional deferrals — they must be answered empirically before writing the corresponding implementation code.

1. **[BLOCKING] Parallel dispatch mechanism:** Does dispatching multiple subagents via the Task tool actually run them in parallel in OpenCode, or is it sequential? **Must be resolved before writing /unleash dispatch logic.** Test: dispatch two Task tool calls in a single message and measure if they execute concurrently. If sequential: revise Section 4.2 step 6 to use sequential dispatch with interleaved progress reporting instead of true parallelism.

2. **[BLOCKING] Token budget API:** Is context usage percentage available to the plugin at runtime via the `@opencode-ai/plugin` SDK, or must it be estimated from message history? **Must be resolved before implementing Circuit Breaker Layer 4.** Check `@opencode-ai/plugin` SDK docs and source for session context metrics. If unavailable: fall back to token count estimation from `current-pursuit.json` message count heuristic.

3. **GLM-5 tool reliability:** How reliably does GLM-5 handle multi-step glob+grep+read chains for Scout? Test with 3-5 representative Scout tasks before committing to GLM-5 as Scout's model. Fallback: use `anthropic/claude-sonnet-4-6` for Scout if GLM-5 is unreliable.

4. **Agent permission scoping:** Can agent `.md` definitions in OpenCode restrict which tools an agent may use (e.g., Scout strictly read-only)? Check OpenCode agent definition schema for a `permissions` or `tools` field. If not supported: enforce read-only via Scout's system prompt instructions only (behavioral, not enforced).

---

---

## 15. Glossary

| Term | Definition |
|------|-----------|
| **Circuit breaker** | A system that stops automated retries after detecting a failure pattern, preventing runaway loops |
| **Compaction** | OpenCode's process of summarizing session history when context window fills up |
| **Handoff** | Structured dispatch message from Conductor to a subagent |
| **Halt flag** | File at `.relentless/halt` whose existence signals all agents to stop |
| **Proxy user** | Conductor acting in place of the human for superpowers approval checkpoints |
| **Pursuit** | A completion loop that repeats until all completion criteria are met |
| **Stall** | A pursuit loop where no progress is made (no todos completed) |

---

*Design approved. Resolve Open Questions #1 and #2 (Section 14) before beginning implementation. Then proceed via superpowers:writing-plans.*
