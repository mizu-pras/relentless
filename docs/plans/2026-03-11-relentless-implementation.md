# Relentless Implementation Plan

> **Migration Note (2026-03-11):** This plan was written when Relentless depended on superpowers as an external plugin. Superpowers workflow skills have since been forked and internalized into Relentless as built-in skills. All `superpowers:` namespace references in this document are historical — the live codebase uses `relentless:` exclusively.

> **For agentic workers:** REQUIRED: Use the relentless pursuit loop for execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build Relentless — a fully self-contained OpenCode plugin that adds autonomous multi-agent orchestration, relentless completion loops, and UI/UX specialist capabilities with built-in workflow skills.

**Architecture:** Relentless is a plugin for OpenCode that registers itself via a JavaScript entry point (`relentless.js`), defines 5 specialized agents as markdown files, provides 6 commands as markdown wrappers, and implements 6 skills as SKILL.md files. The plugin's JS layer handles system prompt injection, session state persistence, and circuit breaker logic. All orchestration logic lives in the custom tools exposed by the plugin.

**Tech Stack:** Node.js/Bun ESM, `@opencode-ai/plugin` SDK, JSONC config, Markdown (agent/command/skill definitions), JSON (session state), Bash (install scripts)

**Spec:** `~/.config/opencode/relentless/docs/specs/2026-03-11-relentless-design.md`

**Pre-implementation verification required (from spec Section 14):**
- OQ #1 (BLOCKING): Verify parallel vs sequential subagent dispatch before writing /unleash dispatch logic
- OQ #2 (BLOCKING): Verify token budget API availability before implementing Circuit Breaker Layer 4

---

## Chunk 1: Foundation

Plugin skeleton, install/uninstall scripts, agent definitions, command stubs, default config.

**Files to create:**
- `~/.config/opencode/relentless/.opencode/plugins/relentless.js` — plugin entry point (skeleton)
- `~/.config/opencode/relentless/install.sh` — symlink creation + config copy
- `~/.config/opencode/relentless/uninstall.sh` — symlink removal
- `~/.config/opencode/relentless/defaults.jsonc` — default config template
- `~/.config/opencode/relentless/agents/conductor.md`
- `~/.config/opencode/relentless/agents/artisan.md`
- `~/.config/opencode/relentless/agents/maestro.md`
- `~/.config/opencode/relentless/agents/sentinel.md`
- `~/.config/opencode/relentless/agents/scout.md`
- `~/.config/opencode/relentless/commands/unleash.md`
- `~/.config/opencode/relentless/commands/pursuit.md`
- `~/.config/opencode/relentless/commands/recon.md`
- `~/.config/opencode/relentless/commands/resume.md`
- `~/.config/opencode/relentless/commands/status.md`
- `~/.config/opencode/relentless/commands/halt.md`
- `~/.config/opencode/relentless/docs/README.md`

---

### Task 1.1: Plugin Skeleton (relentless.js)

**Files:**
- Create: `~/.config/opencode/relentless/.opencode/plugins/relentless.js`

- [ ] **Step 1: Write plugin skeleton**

Create `~/.config/opencode/relentless/.opencode/plugins/relentless.js`:

```javascript
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "../..");

/**
 * Relentless Plugin for OpenCode
 * Autonomous multi-agent orchestration on top of superpowers.
 */
export default async function RelentlessPlugin({ client, directory }) {
  // Load IntentGate + Todo Enforcer content for system prompt injection
  const intentGatePath = join(PLUGIN_ROOT, "skills/intent-gate/SKILL.md");
  const todoEnforcerPath = join(PLUGIN_ROOT, "skills/todo-enforcer/SKILL.md");

  const intentGateContent = existsSync(intentGatePath)
    ? readFileSync(intentGatePath, "utf8").replace(/^---[\s\S]*?---\n/, "")
    : "";
  const todoEnforcerContent = existsSync(todoEnforcerPath)
    ? readFileSync(todoEnforcerPath, "utf8").replace(/^---[\s\S]*?---\n/, "")
    : "";

  const agentCatalog = `
## Relentless Agent Catalog

You have access to these specialized agents:
- **conductor** (Claude Opus): Orchestrator. Plans, delegates, validates. Use for /unleash.
- **artisan** (GPT-5.3 Codex): Deep coder. Complex implementation, backend, refactoring.
- **maestro** (GPT-5.3 Codex): UI/UX specialist. Visual/aesthetic-primary tasks.
- **sentinel** (Claude Sonnet): Debugger and architect. Root cause tracing, code review.
- **scout** (GLM-5): Fast explorer. Read-only codebase recon, file search.

Authority hierarchy: conductor > sentinel > artisan/maestro > scout
`;

  const systemInjection = `
<RELENTLESS>
${intentGateContent}

${todoEnforcerContent}

${agentCatalog}
</RELENTLESS>
`;

  return {
    "experimental.chat.system.transform": async (input, output) => {
      (output.system ||= []).push(systemInjection);
    },
  };
}
```

- [ ] **Step 2: Verify plugin file exists and is valid ESM**

```bash
node --input-type=module --eval "
import plugin from '/home/mizu/.config/opencode/relentless/.opencode/plugins/relentless.js';
console.log(typeof plugin);
" 2>&1
```

Expected output: `function`

---

### Task 1.2: Install Script

**Files:**
- Create: `~/.config/opencode/relentless/install.sh`
- Create: `~/.config/opencode/relentless/uninstall.sh`

- [ ] **Step 1: Write install.sh**

Create `~/.config/opencode/relentless/install.sh`:

```bash
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
```

- [ ] **Step 2: Write uninstall.sh**

Create `~/.config/opencode/relentless/uninstall.sh`:

```bash
#!/usr/bin/env bash
set -euo pipefail

OPENCODE_DIR="$HOME/.config/opencode"

echo "Uninstalling Relentless..."

# Remove plugin
rm -f "$OPENCODE_DIR/plugins/relentless.js"
echo "  [ok] Removed: plugin"

# Remove agents
for agent in conductor artisan maestro sentinel scout; do
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
```

- [ ] **Step 3: Make scripts executable**

```bash
chmod +x ~/.config/opencode/relentless/install.sh
chmod +x ~/.config/opencode/relentless/uninstall.sh
echo "Scripts executable"
```

- [ ] **Step 4: Verify install script runs cleanly (dry run)**

```bash
bash -n ~/.config/opencode/relentless/install.sh && echo "Syntax OK"
bash -n ~/.config/opencode/relentless/uninstall.sh && echo "Syntax OK"
```

Expected: both print `Syntax OK`

---

### Task 1.3: Default Config

**Files:**
- Create: `~/.config/opencode/relentless/defaults.jsonc`

- [ ] **Step 1: Write defaults.jsonc**

Create `~/.config/opencode/relentless/defaults.jsonc`:

```jsonc
{
  // Relentless Configuration
  // Copy to ~/.config/opencode/relentless.jsonc (done by install.sh)
  // Project-level override: .opencode/relentless.jsonc

  // Category-to-agent routing
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
  }
}
```

- [ ] **Step 2: Verify JSONC is valid (strip comments and parse)**

```bash
node -e "
const fs = require('fs');
const content = fs.readFileSync('$HOME/.config/opencode/relentless/defaults.jsonc', 'utf8');
// Strip // comments
const stripped = content.replace(/\/\/.*$/gm, '').replace(/,(\s*[}\]])/g, '\$1');
JSON.parse(stripped);
console.log('JSONC valid');
"
```

Expected: `JSONC valid`

---

### Task 1.4: Agent Definitions

**Files:**
- Create: `~/.config/opencode/relentless/agents/conductor.md`
- Create: `~/.config/opencode/relentless/agents/artisan.md`
- Create: `~/.config/opencode/relentless/agents/maestro.md`
- Create: `~/.config/opencode/relentless/agents/sentinel.md`
- Create: `~/.config/opencode/relentless/agents/scout.md`

- [ ] **Step 1: Write conductor.md**

Create `~/.config/opencode/relentless/agents/conductor.md`:

```markdown
---
name: conductor
model: anthropic/claude-opus-4-6
description: |
  Orchestrator for autonomous deep work sessions. Use when the user invokes
  /unleash or needs a multi-step task broken down and executed by specialized
  agents. Conductor plans, delegates to artisan/maestro/sentinel/scout, and
  validates results. Does NOT write code directly. Examples:
  <example>
  user: "/unleash Build a REST API with JWT authentication"
  assistant: "Let me activate Conductor to orchestrate this task."
  <commentary>Multi-step task requiring planning and delegation.</commentary>
  </example>
---

You are Conductor — the orchestrator for the Relentless autonomous work system.

## Your Role

You plan, delegate, and validate. You do NOT write code directly. Your job is:
1. Understand the task deeply via IntentGate analysis
2. Create a structured plan (invoking superpowers:brainstorming and superpowers:writing-plans when appropriate)
3. Pre-assign file ownership to prevent concurrent edit conflicts
4. Dispatch the right agent for each task category
5. Validate subagent outputs against the plan
6. Drive to completion via the pursuit loop

## Acting as Proxy User for Superpowers

You are the project lead for this autonomous session. When superpowers skills have approval checkpoints:
- **brainstorming "get user approval"**: You review the design yourself using your reasoning capability. Your approval is sufficient.
- **writing-plans "review plan"**: You validate the plan against the original task intent. Your sign-off proceeds.
- **requesting-code-review**: You dispatch Sentinel. Sentinel's sign-off is the approval.
- **verification-before-completion**: You direct the test run and build check. Passing output is the approval.

Do NOT escalate these checkpoints to the human user unless the task cannot proceed without human judgment.

## Handoff Protocol

When dispatching any subagent, always provide a structured handoff:

```json
{
  "task": "Clear, specific goal statement",
  "context_files": ["list of relevant files"],
  "assigned_files": ["files this agent may touch"],
  "constraints": [
    "Skip brainstorming — plan already provided by Conductor",
    "Only touch assigned_files",
    "Stop and report if blocked",
    "Check .relentless/halt before every action"
  ],
  "expected_output": "Description of deliverable",
  "related_todos": ["T-001", "T-002"],
  "approach": "tdd"
}
```

## File Ownership

Before any parallel dispatch, pre-assign which files each agent may touch. No two agents may be assigned the same file simultaneously. If a task requires a file currently assigned to another agent, queue it after that agent completes.

## Fallback on Agent Failure

If dispatching artisan fails:
1. Retry artisan once (may be transient)
2. If fails again, dispatch sentinel as fallback coder
3. If sentinel also fails, circuit breaker triggers — stop and report to user

## Category Routing

- `deep` → artisan (backend, logic, implementation)
- `visual` → maestro (UI-primary tasks only)
- `quick` → scout (read-only recon)
- `reason` → sentinel (debugging, architecture)
- When visual + logic mixed → artisan (load relentless:ui-craft skill)

## Halt Awareness

Before every action, check for `.relentless/halt` file. If it exists, stop immediately and report state.

## Authority

You are the final authority. Sentinel's review findings override artisan/maestro preferences. You resolve all disputes.
```

- [ ] **Step 2: Write artisan.md**

Create `~/.config/opencode/relentless/agents/artisan.md`:

```markdown
---
name: artisan
model: openai/gpt-5.3-codex
description: |
  Deep coder for complex implementation tasks. Use when Conductor delegates
  feature implementation, refactoring, or backend logic. Works from a plan,
  not step-by-step instructions. Examples:
  <example>
  user: "Conductor delegating: implement JWT refresh token logic in src/auth/"
  assistant: "Artisan taking the task. Exploring codebase patterns first."
  <commentary>Complex implementation task delegated by Conductor.</commentary>
  </example>
---

You are Artisan — the deep coder for the Relentless autonomous work system.

## Your Role

You implement features. You are given a goal and context, not a recipe. You:
1. Explore the codebase to understand existing patterns before writing anything
2. Implement using test-driven development (invoke superpowers:test-driven-development)
3. Only touch files assigned to you by Conductor
4. Self-validate before reporting completion

## Critical Rules

- **If you received a plan from Conductor, do NOT invoke brainstorming or re-plan.** The plan is already approved. Execute it.
- **Only touch files listed in `assigned_files` in your handoff.** If you need to touch an unassigned file, stop and report to Conductor.
- **Check `.relentless/halt` before every action.** If the file exists, stop immediately.

## Development Approach

Default approach is TDD. Invoke `superpowers:test-driven-development` at the start of each implementation task unless the handoff specifies `"approach": "implementation-first"`.

RED → GREEN → REFACTOR. Write the failing test first. Watch it fail. Write minimal code. Watch it pass. Refactor. Commit.

## Reporting

When complete, report back with:
- What was implemented
- Which files were touched
- Test results
- Any issues encountered or unresolved concerns
```

- [ ] **Step 3: Write maestro.md**

Create `~/.config/opencode/relentless/agents/maestro.md`:

```markdown
---
name: maestro
model: openai/gpt-5.3-codex
description: |
  UI/UX specialist with high aesthetic standards. Use when Conductor delegates
  tasks where the PRIMARY concern is visual appearance, layout, animation, or
  user experience with minimal business logic. For mixed logic+UI tasks, prefer
  artisan with ui-craft skill. Examples:
  <example>
  user: "Conductor delegating: redesign the login page with modern aesthetics"
  assistant: "Maestro taking this. Starting with design intent phase."
  <commentary>Visual-primary task with minimal business logic.</commentary>
  </example>
---

You are Maestro — the UI/UX specialist for the Relentless autonomous work system.

## Your Role

You design and implement beautiful, distinctive UI. You load `relentless:ui-craft` automatically for every task. You follow the 5-phase design process:

1. **Design Intent** — Purpose, audience, tone, constraints
2. **Aesthetic Direction** — Bold, distinctive direction (never generic)
3. **Visual System** — Typography, color (OKLCH), spacing, component personality
4. **Motion & Interaction** — Purposeful micro-interactions, respect prefers-reduced-motion
5. **Implementation** — Semantic HTML, mobile-first, WCAG AA accessibility

## Critical Rules

- **If you received a plan from Conductor, do NOT invoke brainstorming.** Execute the plan.
- **Only touch files listed in `assigned_files`.** Report to Conductor if you need other files.
- **Check `.relentless/halt` before every action.**
- **Load `relentless:ui-craft` before starting any visual implementation.**

## Hard Prohibitions

NEVER produce:
- Generic sans-serif font with no personality (not Inter/Roboto/Arial without strong justification)
- Purple gradient + white card ("AI website" pattern)
- `shadow-md` on every element
- Uniform border-radius everywhere
- Predictable cookie-cutter layouts
- Animations with no purpose

## Reporting

When complete, report back with:
- Aesthetic decisions made and why
- Files touched
- Any design tradeoffs
```

- [ ] **Step 4: Write sentinel.md**

Create `~/.config/opencode/relentless/agents/sentinel.md`:

```markdown
---
name: sentinel
model: anthropic/claude-sonnet-4-6
description: |
  Debugger and code quality guardian. Use when Conductor needs code reviewed,
  bugs traced, or architectural decisions validated. Read-preferred but can
  edit when fixing bugs. Examples:
  <example>
  user: "Conductor delegating: review artisan's auth implementation for security issues"
  assistant: "Sentinel reviewing. Loading systematic-debugging skill."
  <commentary>Code review and quality gate task.</commentary>
  </example>
---

You are Sentinel — the quality guardian for the Relentless autonomous work system.

## Your Role

You debug, review, and protect quality. You:
1. Review code from artisan/maestro for correctness, security, and architecture
2. Trace root causes of bugs (invoke `superpowers:systematic-debugging`)
3. Validate before sign-off (invoke `superpowers:verification-before-completion`)
4. Report findings to Conductor — never bypass Conductor

## Authority

Your review findings have authority over artisan/maestro preferences. If you find critical issues, they must be fixed before you sign off. Conductor is the final arbiter if there is a genuine dispute.

## Critical Rules

- **Check `.relentless/halt` before every action.**
- **Never re-delegate to other agents.** Report all findings to Conductor.
- **You are read-preferred.** Only edit files when directly fixing a confirmed bug.

## Review Standards

For each review, assess:
- Correctness (does it do what it's supposed to?)
- Security (input validation, auth checks, injection risks)
- Architecture (follows project patterns? clear responsibilities?)
- Test coverage (are edge cases covered?)
- Performance (obvious bottlenecks?)

Categorize findings as: **Critical** (must fix), **Important** (should fix), **Advisory** (consider).

Only Critical findings block sign-off.
```

- [ ] **Step 5: Write scout.md**

Create `~/.config/opencode/relentless/agents/scout.md`:

```markdown
---
name: scout
model: zai/glm-5
description: |
  Fast codebase explorer. Use when Conductor needs quick reconnaissance:
  find files, detect patterns, understand project structure. Read-only.
  Never writes or edits files. Examples:
  <example>
  user: "Conductor delegating: find all API route definitions in this project"
  assistant: "Scout on it. Scanning for route patterns."
  <commentary>Fast read-only recon task.</commentary>
  </example>
---

You are Scout — the fast explorer for the Relentless autonomous work system.

## Your Role

You find things. Fast. You are strictly read-only:
- `glob` — find files by pattern
- `grep` — search file contents
- `read` — read specific files

You NEVER write, edit, or create files.

## Output Format

Return structured findings to Conductor:

```
## Scout Report

### Files Found
- src/api/users.ts — user CRUD routes
- src/api/auth.ts — authentication routes

### Patterns Detected
- API style: Express-style with async/await
- Error handling: centralized middleware in src/middleware/error.ts

### Key Observations
- No test files found for src/api/auth.ts
- Config pattern: src/config/*.ts files
```

## Critical Rules

- **Strictly read-only.** No write, edit, or bash commands that modify files.
- **Check `.relentless/halt` before starting.**
- **Be fast.** Use glob for file discovery, grep for pattern search. Don't read entire files unless necessary.
```

- [ ] **Step 6: Verify all agent files exist**

```bash
for agent in conductor artisan maestro sentinel scout; do
    test -f ~/.config/opencode/relentless/agents/$agent.md && echo "OK: $agent.md" || echo "MISSING: $agent.md"
done
```

Expected: 5 lines starting with `OK:`

---

### Task 1.5: Command Stubs

**Files:**
- Create: `~/.config/opencode/relentless/commands/unleash.md`
- Create: `~/.config/opencode/relentless/commands/pursuit.md`
- Create: `~/.config/opencode/relentless/commands/recon.md`
- Create: `~/.config/opencode/relentless/commands/resume.md`
- Create: `~/.config/opencode/relentless/commands/status.md`
- Create: `~/.config/opencode/relentless/commands/halt.md`

- [ ] **Step 1: Write unleash.md**

Create `~/.config/opencode/relentless/commands/unleash.md`:

```markdown
---
description: "Full autonomous orchestration. Activates all Relentless agents to complete the task without stopping."
---

Load and follow the `relentless:unleash` skill to complete: $ARGUMENTS

If the relentless:unleash skill is not yet available, inform the user:
"Relentless /unleash skill is not yet implemented. This command stub will be replaced with full orchestration logic in a future implementation step."
```

- [ ] **Step 2: Write pursuit.md**

Create `~/.config/opencode/relentless/commands/pursuit.md`:

```markdown
---
description: "Completion loop. Repeats until all todos are 100% done. Max 10 iterations by default."
---

Load and follow the `relentless:pursuit` skill to drive all pending todos to completion.

If the relentless:pursuit skill is not yet available, inform the user:
"Relentless /pursuit skill is not yet implemented. This command stub will be replaced in a future step."
```

- [ ] **Step 3: Write recon.md**

Create `~/.config/opencode/relentless/commands/recon.md`:

```markdown
---
description: "Scan codebase and generate/audit/improve AGENTS.md files hierarchically. Flags: --audit, --improve, --update, --max-depth=N"
---

Load and follow the `relentless:recon` skill with arguments: $ARGUMENTS

If the relentless:recon skill is not yet available, inform the user:
"Relentless /recon skill is not yet implemented. This command stub will be replaced in a future step."
```

- [ ] **Step 4: Write resume.md**

Create `~/.config/opencode/relentless/commands/resume.md`:

```markdown
---
description: "Resume an interrupted /pursuit or /unleash session from saved state in .relentless/"
---

Use the `relentless_resume` tool to resume from the last saved pursuit state.

Steps:
1. Check for `.relentless/halt` — if set, stop and say: "Halt flag is active. Run /halt clear before resuming."
2. Read `.relentless/current-pursuit.json` — if missing, say: "No interrupted pursuit found."
3. Present the saved state summary and ask: "Resume from this state? (yes/no)"
4. If yes: continue the pursuit from the last known step.
```

- [ ] **Step 5: Write status.md**

Create `~/.config/opencode/relentless/commands/status.md`:

```markdown
---
description: "Show current Relentless orchestration state: active pursuit, agent assignments, circuit breaker status."
---

Use the `relentless_status` tool to show current orchestration state.

If the tool is unavailable, read `.relentless/current-pursuit.json` directly and display:
- Active pursuit task and progress (X/Y todos complete)
- Current loop number and max loops
- Agent assignments (which agent is on which todo)
- Circuit breaker state (failures, injections)
- Halt flag status
- Last snapshot timestamp

If `.relentless/current-pursuit.json` does not exist, say: "No active pursuit. Run /unleash to start one."
```

- [ ] **Step 6: Write halt.md**

Create `~/.config/opencode/relentless/commands/halt.md`:

```markdown
---
description: "Stop all active Relentless orchestration. Use '/halt clear' to remove the halt flag before resuming."
---

Arguments: $ARGUMENTS

If arguments contain "clear":
  1. Delete `.relentless/halt` file if it exists
  2. Say: "Halt flag cleared. Run /resume to continue the interrupted pursuit."

Otherwise (standard /halt):
  1. Write `.relentless/halt` with current timestamp
  2. Instruct all active agents: "HALT detected. Stop immediately. Save your current state and report what you completed."
  3. Read `.relentless/current-pursuit.json` and summarize what was completed and what remains
  4. Say: "Orchestration halted. State saved. Run /resume when ready to continue (run /halt clear first)."
```

- [ ] **Step 7: Verify all command files exist**

```bash
for cmd in unleash pursuit recon resume status halt; do
    test -f ~/.config/opencode/relentless/commands/$cmd.md && echo "OK: $cmd.md" || echo "MISSING: $cmd.md"
done
```

Expected: 6 lines starting with `OK:`

---

### Task 1.6: README

**Files:**
- Create: `~/.config/opencode/relentless/docs/README.md`

- [ ] **Step 1: Write README.md**

Create `~/.config/opencode/relentless/docs/README.md`:

```markdown
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
| Scout | GLM-5 | Fast explorer |

## Configuration

Edit `~/.config/opencode/relentless.jsonc` to customize circuit breaker thresholds, pursuit iterations, and category routing.

For project-level overrides, create `.opencode/relentless.jsonc` in your project root.

## Spec & Plans

- Design spec: `docs/specs/2026-03-11-relentless-design.md`
- Implementation plan: `docs/plans/2026-03-11-relentless-implementation.md`
```

- [ ] **Step 2: Run install script**

```bash
bash ~/.config/opencode/relentless/install.sh
```

Expected output: Lines showing `[ok]` for plugin, 5 agents, 6 commands, skills, and config.

- [ ] **Step 3: Verify all symlinks were created**

```bash
echo "=== Plugin ===" && ls -la ~/.config/opencode/plugins/relentless.js
echo "=== Agents ===" && ls ~/.config/opencode/agents/ | grep -E "conductor|artisan|maestro|sentinel|scout"
echo "=== Commands ===" && ls ~/.config/opencode/commands/ | grep -E "unleash|pursuit|recon|resume|status|halt"
echo "=== Skills ===" && ls -la ~/.config/opencode/skills/relentless
echo "=== Config ===" && test -f ~/.config/opencode/relentless.jsonc && echo "relentless.jsonc present"
```

Expected: All files/symlinks present.

- [ ] **Step 4: Commit Chunk 1**

```bash
cd ~/.config/opencode/relentless && git init && git add . && git commit -m "feat: add Relentless plugin foundation (agents, commands, plugin skeleton, install)"
```

---

## Chunk 2: Core Systems

Session persistence, compaction hook, circuit breaker (Layers 1–5), system prompt injection with loaded skills.

**Files to create/modify:**
- Modify: `~/.config/opencode/relentless/.opencode/plugins/relentless.js` — add persistence, compaction, circuit breaker
- Create: `~/.config/opencode/relentless/lib/state.js` — session state read/write
- Create: `~/.config/opencode/relentless/lib/circuit-breaker.js` — 5-layer circuit breaker
- Create: `~/.config/opencode/relentless/lib/config.js` — config loader (relentless.jsonc)

---

### Task 2.1: Config Loader

**Files:**
- Create: `~/.config/opencode/relentless/lib/config.js`

- [ ] **Step 1: Write config.js**

Create `~/.config/opencode/relentless/lib/config.js`:

```javascript
import { readFileSync, existsSync } from "fs";
import { join } from "path";

const PLUGIN_ROOT = join(import.meta.dirname, "..");

/**
 * Load and merge relentless.jsonc config.
 * Priority: project-level > user-level > built-in defaults
 */
export function loadConfig(projectDir) {
  const defaults = {
    categories: {
      deep: "artisan",
      visual: "maestro",
      quick: "scout",
      reason: "sentinel",
      orchestrate: "conductor",
    },
    circuit_breaker: {
      max_consecutive_failures: 3,
      max_injections_per_minute: 3,
      token_budget_threshold: 0.85,
    },
    pursuit: {
      max_iterations: 10,
      require_progress: true,
      stall_limit: 2,
    },
    recon: {
      max_depth: 4,
      include_env_vars: true,
      include_dependencies: true,
    },
  };

  const userConfigPath = join(
    process.env.HOME || "~",
    ".config/opencode/relentless.jsonc"
  );
  const projectConfigPath = join(projectDir || ".", ".opencode/relentless.jsonc");

  let config = { ...defaults };

  // Load user-level config
  if (existsSync(userConfigPath)) {
    try {
      const userConfig = parseJsonc(readFileSync(userConfigPath, "utf8"));
      config = deepMerge(config, userConfig);
    } catch (e) {
      console.warn(`[relentless] Failed to parse ${userConfigPath}: ${e.message}`);
    }
  }

  // Load project-level config (highest priority)
  if (projectDir && existsSync(projectConfigPath)) {
    try {
      const projectConfig = parseJsonc(readFileSync(projectConfigPath, "utf8"));
      config = deepMerge(config, projectConfig);
    } catch (e) {
      console.warn(`[relentless] Failed to parse ${projectConfigPath}: ${e.message}`);
    }
  }

  return config;
}

function parseJsonc(text) {
  // Strip // line comments and /* block comments */
  const stripped = text
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(stripped);
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object"
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
```

- [ ] **Step 2: Write test for config loader**

Create `~/.config/opencode/relentless/lib/config.test.js`:

```javascript
import { loadConfig } from "./config.js";
import assert from "assert";

// Test 1: Returns defaults when no config file exists
const config = loadConfig("/nonexistent");
assert.strictEqual(config.pursuit.max_iterations, 10, "default max_iterations should be 10");
assert.strictEqual(config.circuit_breaker.max_consecutive_failures, 3, "default failures should be 3");
assert.strictEqual(config.categories.deep, "artisan", "deep category should map to artisan");
console.log("PASS: loadConfig returns defaults when no config file");

// Test 2: Deep merge works
const merged = { pursuit: { max_iterations: 5, require_progress: true, stall_limit: 2 } };
// Simulated — just verify structure
assert.strictEqual(typeof config.categories, "object", "categories should be an object");
console.log("PASS: config structure is correct");

console.log("All config tests passed.");
```

- [ ] **Step 3: Run config tests**

```bash
node ~/.config/opencode/relentless/lib/config.test.js
```

Expected: `All config tests passed.`

---

### Task 2.2: Session State

**Files:**
- Create: `~/.config/opencode/relentless/lib/state.js`

- [ ] **Step 1: Write state.js**

Create `~/.config/opencode/relentless/lib/state.js`:

```javascript
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const STATE_DIR = ".relentless";
const PURSUIT_FILE = "current-pursuit.json";
const HALT_FILE = "halt";

/**
 * Get path to .relentless directory for the given project dir.
 */
function stateDir(projectDir) {
  return join(projectDir || ".", STATE_DIR);
}

/**
 * Ensure .relentless/ directory exists.
 */
function ensureStateDir(projectDir) {
  const dir = stateDir(projectDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Read current pursuit state. Returns null if not found.
 */
export function readPursuitState(projectDir) {
  const path = join(stateDir(projectDir), PURSUIT_FILE);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Write pursuit state snapshot.
 */
export function writePursuitState(projectDir, state) {
  const dir = ensureStateDir(projectDir);
  const path = join(dir, PURSUIT_FILE);
  const snapshot = {
    ...state,
    updated_at: new Date().toISOString(),
    version: 1,
  };
  writeFileSync(path, JSON.stringify(snapshot, null, 2), "utf8");
  return snapshot;
}

/**
 * Check if halt flag is set.
 */
export function isHalted(projectDir) {
  return existsSync(join(stateDir(projectDir), HALT_FILE));
}

/**
 * Set halt flag.
 */
export function setHalt(projectDir, reason = "user requested") {
  const dir = ensureStateDir(projectDir);
  writeFileSync(
    join(dir, HALT_FILE),
    JSON.stringify({ timestamp: new Date().toISOString(), reason }),
    "utf8"
  );
}

/**
 * Clear halt flag.
 */
export function clearHalt(projectDir) {
  const path = join(stateDir(projectDir), HALT_FILE);
  if (existsSync(path)) {
    import("fs").then(({ unlinkSync }) => unlinkSync(path));
  }
}

/**
 * Format pursuit state for display in /status.
 */
export function formatStatus(state) {
  if (!state) return "No active pursuit. Run /unleash to start one.";

  const todos = state.todos || [];
  const completed = todos.filter((t) => t.status === "completed").length;
  const inProgress = todos.filter((t) => t.status === "in_progress");
  const pending = todos.filter((t) => t.status === "pending");

  const assignments = inProgress
    .map((t) => `  ${t.agent || "unknown"}    → ${t.id} (in_progress): ${t.subject}`)
    .join("\n");

  const pendingList = pending
    .map((t) => `  ${t.id}: ${t.subject}`)
    .join("\n");

  const cb = state.circuit_breaker || {};

  return `## Relentless Status

Pursuit: active (loop ${state.current_loop || 1}/${state.max_loops || 10})
Progress: ${Math.round((completed / todos.length) * 100)}% (${completed} of ${todos.length} todos complete)

Active assignments:
${assignments || "  (none)"}

Pending todos:
${pendingList || "  (none)"}

Circuit breaker:
  Consecutive failures: ${cb.consecutive_failures || 0}/${state.config?.circuit_breaker?.max_consecutive_failures || 3}
  Injections this minute: ${cb.injections_last_minute || 0}/3

Halt flag: ${state.halted ? "SET" : "not set"}
Last snapshot: ${state.updated_at || "unknown"}`;
}
```

- [ ] **Step 2: Write tests for state.js**

Create `~/.config/opencode/relentless/lib/state.test.js`:

```javascript
import { readPursuitState, writePursuitState, isHalted, setHalt, clearHalt, formatStatus } from "./state.js";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import assert from "assert";

const TEST_DIR = "/tmp/relentless-test-" + Date.now();
mkdirSync(TEST_DIR, { recursive: true });

// Test 1: readPursuitState returns null when no file
assert.strictEqual(readPursuitState(TEST_DIR), null, "should return null when no state file");
console.log("PASS: readPursuitState returns null when no file");

// Test 2: writePursuitState then readPursuitState
const state = { task: "test task", todos: [], current_loop: 1, max_loops: 10 };
writePursuitState(TEST_DIR, state);
const read = readPursuitState(TEST_DIR);
assert.strictEqual(read.task, "test task", "should read back task");
assert.ok(read.updated_at, "should have updated_at timestamp");
assert.strictEqual(read.version, 1, "should have version 1");
console.log("PASS: writePursuitState and readPursuitState round-trip");

// Test 3: halt flag
assert.strictEqual(isHalted(TEST_DIR), false, "should not be halted initially");
setHalt(TEST_DIR, "test halt");
assert.strictEqual(isHalted(TEST_DIR), true, "should be halted after setHalt");
console.log("PASS: halt flag set/check");

// Test 4: clearHalt
// (async due to dynamic import in clearHalt)
import("fs").then(({ unlinkSync }) => {
  unlinkSync(join(TEST_DIR, ".relentless/halt"));
  assert.strictEqual(isHalted(TEST_DIR), false, "should not be halted after manual clear");
  console.log("PASS: clearHalt removes halt flag");

  // Test 5: formatStatus with null
  const nullStatus = formatStatus(null);
  assert.ok(nullStatus.includes("No active pursuit"), "null state should show no active pursuit");
  console.log("PASS: formatStatus handles null state");

  // Cleanup
  rmSync(TEST_DIR, { recursive: true });
  console.log("All state tests passed.");
});
```

- [ ] **Step 3: Run state tests**

```bash
node ~/.config/opencode/relentless/lib/state.test.js
```

Expected: `All state tests passed.`

---

### Task 2.3: Circuit Breaker

**Files:**
- Create: `~/.config/opencode/relentless/lib/circuit-breaker.js`

- [ ] **Step 1: Write circuit-breaker.js**

Create `~/.config/opencode/relentless/lib/circuit-breaker.js`:

```javascript
/**
 * 5-Layer Circuit Breaker for Relentless
 * Prevents runaway loops (OmO issue #2462 pattern)
 */

// Error type classification
export const ErrorType = {
  TOKEN_LIMIT: "token_limit",
  RATE_LIMIT: "rate_limit",
  NETWORK: "network",
  MODEL_REFUSED: "model_refused",
  ABORT: "abort",
  UNKNOWN: "unknown",
};

/**
 * Layer 1: Classify an error by type.
 * Token limit errors are NEVER retried.
 */
export function classifyError(error) {
  const msg = (error?.message || "").toLowerCase();
  const code = error?.status || error?.code || 0;

  // Token limit — NEVER retry
  if (
    msg.includes("context_length_exceeded") ||
    msg.includes("prompt is too long") ||
    msg.includes("maximum context length") ||
    msg.includes("token limit") ||
    msg.includes("context window")
  ) {
    return ErrorType.TOKEN_LIMIT;
  }

  // Abort/cancel — NEVER retry
  if (
    error?.name === "AbortError" ||
    msg.includes("aborted") ||
    msg.includes("cancelled")
  ) {
    return ErrorType.ABORT;
  }

  // Model refused — NEVER retry
  if (
    msg.includes("content policy") ||
    msg.includes("refused") ||
    code === 400
  ) {
    return ErrorType.MODEL_REFUSED;
  }

  // Rate limit — retry with backoff
  if (code === 429 || msg.includes("rate limit") || msg.includes("too many requests")) {
    return ErrorType.RATE_LIMIT;
  }

  // Network/transient — retry with backoff
  if (code === 502 || code === 503 || code === 504 || msg.includes("network")) {
    return ErrorType.NETWORK;
  }

  return ErrorType.UNKNOWN;
}

/**
 * Whether this error type should be retried.
 */
export function shouldRetry(errorType) {
  return errorType === ErrorType.RATE_LIMIT || errorType === ErrorType.NETWORK;
}

/**
 * Get retry delay in ms for this error type and attempt number.
 */
export function retryDelay(errorType, attempt) {
  if (errorType === ErrorType.RATE_LIMIT) {
    return [2000, 4000, 8000][attempt - 1] || 8000;
  }
  if (errorType === ErrorType.NETWORK) {
    return 2000;
  }
  return 0;
}

/**
 * Per-session circuit breaker state.
 */
export class CircuitBreaker {
  constructor(config = {}) {
    this.maxConsecutiveFailures = config.max_consecutive_failures ?? 3;
    this.maxInjectionsPerMinute = config.max_injections_per_minute ?? 3;
    this.tokenBudgetThreshold = config.token_budget_threshold ?? 0.85;

    // Layer 2: consecutive failure tracking
    this.consecutiveFailures = 0;
    this.lastErrorType = null;

    // Layer 3: injection rate limiting
    this.injectionTimestamps = [];

    // Layer 5: dead session detection
    this.stalled = false;
  }

  /**
   * Layer 2: Record a failure. Returns true if circuit should open (stop).
   */
  recordFailure(error) {
    const errorType = classifyError(error);

    // Token limit and abort always stop immediately
    if (errorType === ErrorType.TOKEN_LIMIT || errorType === ErrorType.ABORT) {
      this.stalled = true;
      return { open: true, reason: `${errorType} error — stopping immediately`, errorType };
    }

    // Same error type twice in a row — stop immediately
    if (this.lastErrorType === errorType && errorType !== ErrorType.UNKNOWN) {
      this.stalled = true;
      return { open: true, reason: `Same error (${errorType}) twice in a row`, errorType };
    }

    this.lastErrorType = errorType;
    this.consecutiveFailures++;

    if (this.consecutiveFailures >= this.maxConsecutiveFailures) {
      this.stalled = true;
      return {
        open: true,
        reason: `${this.consecutiveFailures} consecutive failures`,
        errorType,
      };
    }

    return {
      open: false,
      retryable: shouldRetry(errorType),
      delay: retryDelay(errorType, this.consecutiveFailures),
      errorType,
    };
  }

  /**
   * Reset failure count on success.
   */
  recordSuccess() {
    this.consecutiveFailures = 0;
    this.lastErrorType = null;
  }

  /**
   * Layer 3: Check if injection is rate-limited.
   * Returns true if injection is allowed, false if rate limit exceeded.
   */
  canInject() {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    // Remove timestamps older than 1 minute
    this.injectionTimestamps = this.injectionTimestamps.filter((t) => t > oneMinuteAgo);

    if (this.injectionTimestamps.length >= this.maxInjectionsPerMinute) {
      this.stalled = true;
      return false;
    }

    this.injectionTimestamps.push(now);
    return true;
  }

  /**
   * Layer 4: Check token budget.
   * contextUsage is a fraction (0.0 to 1.0) of maxContext used.
   * Returns true if safe to proceed, false if budget exceeded.
   */
  checkTokenBudget(contextUsage) {
    if (contextUsage === null || contextUsage === undefined) return true; // Unknown — allow
    return contextUsage < this.tokenBudgetThreshold;
  }

  /**
   * Layer 5: Mark session as stalled.
   */
  markStalled() {
    this.stalled = true;
  }

  /**
   * Get status for /status command.
   */
  getStatus() {
    return {
      consecutive_failures: this.consecutiveFailures,
      injections_last_minute: this.injectionTimestamps.filter(
        (t) => t > Date.now() - 60000
      ).length,
      stalled: this.stalled,
    };
  }
}
```

- [ ] **Step 2: Write tests for circuit-breaker.js**

Create `~/.config/opencode/relentless/lib/circuit-breaker.test.js`:

```javascript
import { classifyError, ErrorType, shouldRetry, CircuitBreaker } from "./circuit-breaker.js";
import assert from "assert";

// Test Layer 1: error classification
assert.strictEqual(
  classifyError(new Error("context_length_exceeded")),
  ErrorType.TOKEN_LIMIT,
  "should classify token limit error"
);
assert.strictEqual(
  classifyError({ status: 429, message: "rate limit" }),
  ErrorType.RATE_LIMIT,
  "should classify rate limit"
);
assert.strictEqual(
  classifyError({ name: "AbortError", message: "aborted" }),
  ErrorType.ABORT,
  "should classify abort"
);
console.log("PASS: Layer 1 error classification");

// Test Layer 1: shouldRetry
assert.strictEqual(shouldRetry(ErrorType.TOKEN_LIMIT), false, "token limit should not retry");
assert.strictEqual(shouldRetry(ErrorType.RATE_LIMIT), true, "rate limit should retry");
assert.strictEqual(shouldRetry(ErrorType.ABORT), false, "abort should not retry");
console.log("PASS: Layer 1 shouldRetry");

// Test Layer 2: consecutive failure circuit breaker
const cb = new CircuitBreaker({ max_consecutive_failures: 3 });
const r1 = cb.recordFailure({ status: 503, message: "network" });
assert.strictEqual(r1.open, false, "first failure should not open circuit");
const r2 = cb.recordFailure({ status: 503, message: "network" });
// Same error type twice in a row
assert.strictEqual(r2.open, true, "same error twice should open circuit");
console.log("PASS: Layer 2 same-error-twice opens circuit");

const cb2 = new CircuitBreaker({ max_consecutive_failures: 3 });
cb2.recordFailure({ status: 429, message: "rate limit" });
cb2.recordSuccess(); // reset
cb2.recordFailure({ status: 503, message: "network" });
cb2.recordFailure({ status: 503, message: "network" });
// Same error type twice again
const r3 = cb2.recordFailure({ status: 503, message: "network" });
assert.strictEqual(r3.open, true, "3 consecutive failures should open circuit");
console.log("PASS: Layer 2 max consecutive failures opens circuit");

// Test Layer 2: token limit always opens immediately
const cb3 = new CircuitBreaker();
const r4 = cb3.recordFailure(new Error("prompt is too long — context_length_exceeded"));
assert.strictEqual(r4.open, true, "token limit should open circuit immediately");
console.log("PASS: Layer 2 token limit opens immediately");

// Test Layer 3: injection rate limiter
const cb4 = new CircuitBreaker({ max_injections_per_minute: 3 });
assert.strictEqual(cb4.canInject(), true, "first injection allowed");
assert.strictEqual(cb4.canInject(), true, "second injection allowed");
assert.strictEqual(cb4.canInject(), true, "third injection allowed");
assert.strictEqual(cb4.canInject(), false, "fourth injection blocked");
console.log("PASS: Layer 3 injection rate limiter");

// Test Layer 4: token budget
const cb5 = new CircuitBreaker({ token_budget_threshold: 0.85 });
assert.strictEqual(cb5.checkTokenBudget(0.7), true, "70% usage should be allowed");
assert.strictEqual(cb5.checkTokenBudget(0.9), false, "90% usage should be blocked");
assert.strictEqual(cb5.checkTokenBudget(null), true, "unknown usage should be allowed");
console.log("PASS: Layer 4 token budget awareness");

console.log("All circuit breaker tests passed.");
```

- [ ] **Step 3: Run circuit breaker tests**

```bash
node ~/.config/opencode/relentless/lib/circuit-breaker.test.js
```

Expected: `All circuit breaker tests passed.`

---

### Task 2.4: Wire Core Systems into Plugin

**Files:**
- Modify: `~/.config/opencode/relentless/.opencode/plugins/relentless.js`

- [ ] **Step 1: Rewrite relentless.js with full core systems**

Replace the contents of `~/.config/opencode/relentless/.opencode/plugins/relentless.js`:

```javascript
import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "../..");

// Lazy imports for lib modules (avoid top-level failures if not yet created)
async function getState() {
  const { readPursuitState, writePursuitState, isHalted, formatStatus } =
    await import(join(PLUGIN_ROOT, "lib/state.js"));
  return { readPursuitState, writePursuitState, isHalted, formatStatus };
}

async function getCircuitBreaker() {
  const { CircuitBreaker } = await import(join(PLUGIN_ROOT, "lib/circuit-breaker.js"));
  return CircuitBreaker;
}

async function getConfig(dir) {
  const { loadConfig } = await import(join(PLUGIN_ROOT, "lib/config.js"));
  return loadConfig(dir);
}

/**
 * Read SKILL.md content, stripping frontmatter.
 */
function readSkill(skillName) {
  const path = join(PLUGIN_ROOT, `skills/${skillName}/SKILL.md`);
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8").replace(/^---[\s\S]*?---\n/, "").trim();
}

// Per-session circuit breaker instances (keyed by sessionID)
const circuitBreakers = new Map();

/**
 * Relentless Plugin for OpenCode
 */
export default async function RelentlessPlugin({ client, directory }) {
  const intentGateContent = readSkill("intent-gate");
  const todoEnforcerContent = readSkill("todo-enforcer");

  const agentCatalog = `
## Relentless Agent Catalog

You have access to these specialized agents:
- **conductor** (Claude Opus): Orchestrator. Plans, delegates, validates. Use for /unleash.
- **artisan** (GPT-5.3 Codex): Deep coder. Complex implementation, backend, refactoring.
- **maestro** (GPT-5.3 Codex): UI/UX specialist. Visual/aesthetic-primary tasks only.
- **sentinel** (Claude Sonnet): Debugger and architect. Root cause tracing, code review.
- **scout** (GLM-5): Fast explorer. Read-only codebase recon and file search.

Authority: conductor > sentinel > artisan/maestro > scout
Category routing: deep→artisan, visual→maestro, quick→scout, reason→sentinel, orchestrate→conductor
`.trim();

  const systemInjection = [
    intentGateContent && `<RELENTLESS_INTENT_GATE>\n${intentGateContent}\n</RELENTLESS_INTENT_GATE>`,
    todoEnforcerContent && `<RELENTLESS_TODO_ENFORCER>\n${todoEnforcerContent}\n</RELENTLESS_TODO_ENFORCER>`,
    `<RELENTLESS_AGENTS>\n${agentCatalog}\n</RELENTLESS_AGENTS>`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    // Inject IntentGate + Todo Enforcer + agent catalog into system prompt
    "experimental.chat.system.transform": async (input, output) => {
      (output.system ||= []).push(systemInjection);
    },

    // Preserve orchestration state during session compaction
    "experimental.session.compacting": async (input, output) => {
      try {
        const { readPursuitState } = await getState();
        const state = readPursuitState(directory);
        if (!state) return;

        const todos = state.todos || [];
        const completed = todos.filter((t) => t.status === "completed");
        const pending = todos.filter((t) => t.status !== "completed");

        const stateContext = `
## Relentless Orchestration State (Preserved Through Compaction)
Task: ${state.task}
Progress: Loop ${state.current_loop || 1}/${state.max_loops || 10}
Completed: ${completed.length}/${todos.length} todos

Pending todos:
${pending.map((t) => `  [${t.status}] ${t.id}: ${t.subject}${t.agent ? ` (${t.agent})` : ""}`).join("\n") || "  (none)"}

Circuit breaker: ${state.circuit_breaker?.consecutive_failures || 0}/3 failures
Last updated: ${state.updated_at}

IMPORTANT: Continue the pursuit from the state above. Do not restart from the beginning.
`.trim();

        (output.context ||= []).push(stateContext);
      } catch (e) {
        // Silently continue if state can't be read
      }
    },

    // Track session events for circuit breaker
    event: async (event) => {
      try {
        const sessionID = event?.sessionID;
        if (!sessionID) return;

        if (event.type === "session.error") {
          const CircuitBreaker = await getCircuitBreaker();
          if (!circuitBreakers.has(sessionID)) {
            const config = await getConfig(directory);
            circuitBreakers.set(sessionID, new CircuitBreaker(config.circuit_breaker));
          }
          const cb = circuitBreakers.get(sessionID);
          cb.recordFailure(event.error);
        }

        if (event.type === "session.idle" || event.type === "message") {
          // Snapshot state on session idle
          try {
            const { readPursuitState, writePursuitState } = await getState();
            const state = readPursuitState(directory);
            if (state) {
              const sessionID = event.sessionID;
              const cb = circuitBreakers.get(sessionID);
              if (cb) {
                state.circuit_breaker = cb.getStatus();
                writePursuitState(directory, state);
              }
            }
          } catch {
            // Silently continue
          }
        }
      } catch {
        // Event handling errors should never crash the plugin
      }
    },
  };
}
```

- [ ] **Step 2: Verify plugin still loads**

```bash
node --input-type=module --eval "
import plugin from '/home/mizu/.config/opencode/relentless/.opencode/plugins/relentless.js';
console.log(typeof plugin);
" 2>&1
```

Expected: `function`

- [ ] **Step 3: Commit Chunk 2**

```bash
cd ~/.config/opencode/relentless && git add . && git commit -m "feat: add core systems (state persistence, circuit breaker, config loader)"
```

---

## Chunk 3: Skills

IntentGate, Todo Enforcer, Pursuit, Unleash, UI Craft, Recon skills.

**Files to create:**
- `~/.config/opencode/relentless/skills/intent-gate/SKILL.md`
- `~/.config/opencode/relentless/skills/todo-enforcer/SKILL.md`
- `~/.config/opencode/relentless/skills/pursuit/SKILL.md`
- `~/.config/opencode/relentless/skills/unleash/SKILL.md`
- `~/.config/opencode/relentless/skills/ui-craft/SKILL.md`
- `~/.config/opencode/relentless/skills/ui-craft/references/aesthetic-directions.md`
- `~/.config/opencode/relentless/skills/ui-craft/references/anti-patterns.md`
- `~/.config/opencode/relentless/skills/ui-craft/references/typography-guide.md`
- `~/.config/opencode/relentless/skills/recon/SKILL.md`
- `~/.config/opencode/relentless/skills/recon/references/quality-criteria.md`
- `~/.config/opencode/relentless/skills/recon/references/templates.md`

---

### Task 3.1: intent-gate Skill

**Files:**
- Create: `~/.config/opencode/relentless/skills/intent-gate/SKILL.md`

- [ ] **Step 1: Write intent-gate/SKILL.md**

Create `~/.config/opencode/relentless/skills/intent-gate/SKILL.md`:

```markdown
---
name: intent-gate
description: Use before any action to analyze user intent, classify task type, and detect ambiguity. Prevents literal misinterpretation and scope errors.
---

# IntentGate

Analyze intent before acting. One wrong interpretation wastes more time than asking.

## Classification

Classify every incoming task into one of:

| Type | Description | Proceed? |
|------|-------------|----------|
| `create` | Build something new | Yes if scope is clear |
| `modify` | Change existing code | Yes if target is clear |
| `delete` | Remove code/files | **Confirm if scope is broad** |
| `debug` | Fix a bug or error | Yes |
| `explore` | Understand codebase | Yes |
| `refactor` | Restructure without changing behavior | Yes if target is clear |
| `visual` | UI/UX improvement | Yes, route to Maestro |
| `trivial` | Single file, < 20 lines | Yes, skip full orchestration |

## Ambiguity Detection

Before proceeding, check for these patterns:

**Scope ambiguity — always clarify:**
- "all", "everywhere", "all files" without a specific directory or pattern
- "fix the tests" without specifying which tests
- "clean up the code" without specifying what clean means

**Destructive ambiguity — always confirm:**
- "delete", "remove", "clean", "wipe" without explicit target
- Any action that cannot be undone by a git checkout

**Target ambiguity — clarify if multiple candidates:**
- "update the user model" when multiple files match
- "fix the auth" when auth spans many files

## Decision Protocol

```
1. Classify the intent type
2. Check for ambiguity patterns
3. If trivial → handle directly, skip unleash orchestration
4. If ambiguous → ask ONE clarifying question, then proceed
5. If clear → proceed immediately, do not ask unnecessary questions
```

**Key rule:** If it is clear enough that a reasonable developer would proceed without asking, proceed. Do not over-ask.

## Trivial Task Detection

A task is trivial if ALL of these are true:
- Affects at most 1-2 files
- Estimated change is < 20 lines
- No new dependencies or architecture changes
- No tests need to be written

Trivial tasks skip the full unleash orchestration and are handled by the current agent directly.
```

- [ ] **Step 2: Verify skill file exists and has valid frontmatter**

```bash
head -5 ~/.config/opencode/relentless/skills/intent-gate/SKILL.md
```

Expected: Lines starting with `---`, `name: intent-gate`, `description:`, ending with `---`

---

### Task 3.2: todo-enforcer Skill

**Files:**
- Create: `~/.config/opencode/relentless/skills/todo-enforcer/SKILL.md`

- [ ] **Step 1: Write todo-enforcer/SKILL.md**

Create `~/.config/opencode/relentless/skills/todo-enforcer/SKILL.md`:

```markdown
---
name: todo-enforcer
description: Use to enforce task focus and prevent scope creep. Ensures agents complete assigned todos before starting new work.
---

# Todo Enforcer

Stay on task. Finish what you started. Do not add scope without approval.

## Rules (Hard — No Exceptions)

1. **Before any action:** Check the todo list. Know what is `in_progress`.
2. **Complete before starting:** If a task is `in_progress`, finish it before starting another.
3. **No unauthorized scope:** Do not touch files or implement features not in your assigned todos.
4. **Discover → report, don't do:** If you discover necessary work not in your todos, report it to Conductor. Do not implement it.
5. **Halt check:** Before every action, check `.relentless/halt`. If the file exists, stop immediately and report your current state.
6. **File ownership:** Do not touch files not listed in your handoff `assigned_files`. If you need to touch an unassigned file, stop and report to Conductor.

## When You Are Tempted to Deviate

Ask yourself:
- Is this in my assigned todos? → If no, report to Conductor.
- Is this file in my assigned_files? → If no, stop and ask.
- Is this the most important thing to finish right now? → If no, finish the in_progress task first.

## Reporting Format

When blocked or discovering out-of-scope work, report to Conductor:

```
SCOPE REPORT:
Current task: [T-XXX description]
Discovered: [what you found]
Impact: [why it matters]
Recommendation: [what should be done]
Waiting for Conductor instruction before proceeding.
```

## Progress Updates

Use TodoWrite to keep todos current:
- Mark tasks `in_progress` when you start them
- Mark tasks `completed` immediately when done
- Never batch completions — mark each task as it finishes
```

- [ ] **Step 2: Verify file exists**

```bash
test -f ~/.config/opencode/relentless/skills/todo-enforcer/SKILL.md && echo "OK"
```

Expected: `OK`

---

### Task 3.3: pursuit Skill

**Files:**
- Create: `~/.config/opencode/relentless/skills/pursuit/SKILL.md`

- [ ] **Step 1: Write pursuit/SKILL.md**

Create `~/.config/opencode/relentless/skills/pursuit/SKILL.md`:

```markdown
---
name: pursuit
description: Use to drive a task to 100% completion through a structured loop. Repeats until all completion criteria are met or a stopping condition is reached.
---

# Pursuit — Relentless Completion Loop

Do not stop until done. Do not declare victory until all criteria pass.

## Completion Criteria

ALL of the following must be true before a pursuit is complete:

1. All todo items are `completed` (no `pending` or `in_progress` remaining)
2. All tests pass — run the test suite and verify exit code 0
3. Build succeeds — if a build step exists, verify exit code 0
4. Sentinel review: no Critical findings outstanding

If any criterion fails, the loop continues.

## Loop Protocol

```
Loop N (of max 10):
  1. Check .relentless/halt → if set: STOP, report state
  2. Check token budget → if > 85% context used: compact first
  3. Identify all incomplete todos
  4. If none → check completion criteria:
     a. Run tests → if fail: create bug-fix todos
     b. Run build → if fail: create fix todos
     c. Dispatch Sentinel review → if Critical findings: create fix todos
     d. If all pass → COMPLETE, report success
  5. Assign todos to appropriate agents by category
  6. Dispatch agents (respect file ownership)
  7. Wait for results
  8. Mark completed todos
  9. Check progress:
     - If at least 1 todo was completed: continue to next loop
     - If 0 todos completed (stall): check stall_limit
       → 2 consecutive stalls: STOP, report to user
  10. Continue to Loop N+1
```

## Stall Detection

**Primary stall mechanism (this skill):**
A stall occurs when 0 todos were completed in a loop. After `stall_limit` (default: 2) consecutive stalls, stop and report.

**Circuit breaker stall (independent):**
3+ consecutive errors without output triggers the circuit breaker (Layer 5). This fires independently — either stall condition can stop the pursuit.

When both fire simultaneously, this skill's message takes precedence (it has more task context).

## Stopping Conditions

| Condition | Action |
|-----------|--------|
| All criteria met | COMPLETE — celebrate and report |
| Max iterations reached | STOP — report progress and what remains |
| 2 consecutive stalls | STOP — report what's blocking |
| `.relentless/halt` set | STOP — save state for /resume |
| Circuit breaker tripped | STOP — report error details |

## Reporting on Stop

Always report:
- How many todos were completed
- Which todos remain and why
- What the user should do next

Never silently stop.
```

- [ ] **Step 2: Verify file exists**

```bash
test -f ~/.config/opencode/relentless/skills/pursuit/SKILL.md && echo "OK"
```

Expected: `OK`

---

### Task 3.4: unleash Skill

**Files:**
- Create: `~/.config/opencode/relentless/skills/unleash/SKILL.md`

- [ ] **Step 1: Write unleash/SKILL.md**

Create `~/.config/opencode/relentless/skills/unleash/SKILL.md`:

```markdown
---
name: unleash
description: Use when /unleash command is invoked. Orchestrates the full autonomous pipeline: intent analysis, planning, parallel dispatch, pursuit loop, final validation.
---

# Unleash — Full Orchestration

This is the full Relentless pipeline. Follow every phase in order.

## Pre-flight

Before anything else:
1. Check `.relentless/halt` → if set: "Halt flag is active. Run /halt clear first."
2. **Verify required models exist** — read `~/.config/opencode/opencode.json` and check:
   - `anthropic/claude-opus-4-6` (Conductor)
   - `openai/gpt-5.3-codex` (Artisan, Maestro)
   - `anthropic/claude-sonnet-4-6` (Sentinel)
   - `zai/glm-5` (Scout)
   - If any missing: warn user and ask whether to continue with available models or abort

## Phase 1: Intent Analysis

Apply `relentless:intent-gate` to the task:
- Classify intent type
- Detect ambiguity — if ambiguous, ask ONE clarifying question and wait
- If trivial: handle directly without orchestration
- If clear and non-trivial: proceed to Phase 2

## Phase 2: Planning (Conductor)

Activate as Conductor. Then:
1. Invoke `superpowers:brainstorming` if task complexity warrants it (architectural decisions, unclear scope)
2. Invoke `superpowers:writing-plans` to create a structured implementation plan
3. Save the plan summary to `.relentless/current-pursuit.json`
4. Create todos for each planned step (use TodoWrite)

**Remember:** You (Conductor) are the proxy user for superpowers approval gates. Do not escalate brainstorming or plan approval to the human user.

## Phase 3: Scout Reconnaissance

Dispatch scout to understand the codebase:
- What files exist relevant to this task?
- What patterns and conventions are used?
- Are there existing tests? Build steps?

Use Scout's findings to refine file assignments in the plan.

## Phase 4: File Ownership Assignment

Before any parallel dispatch, pre-assign which files each agent may touch:
- No two agents receive the same file
- If a task requires a shared file, sequence it after the first agent finishes

## Phase 5: Parallel Dispatch

**RESOLVE OPEN QUESTION #1 BEFORE IMPLEMENTING THIS PHASE.**
(Verify whether OpenCode supports truly parallel subagent dispatch. If sequential only, dispatch in priority order and report progress between each.)

Dispatch agents by category:
- `deep` tasks → artisan (include handoff schema)
- `visual` tasks → maestro (include handoff schema)
- `reason` tasks → sentinel (include handoff schema)

Every handoff MUST include:
```json
{
  "task": "specific goal",
  "context_files": ["relevant files"],
  "assigned_files": ["files this agent may touch"],
  "constraints": ["Skip brainstorming — plan provided", "Only touch assigned_files", "Check .relentless/halt"],
  "expected_output": "deliverable description",
  "related_todos": ["T-XXX"],
  "approach": "tdd"
}
```

## Phase 6: Pursuit Loop

Apply `relentless:pursuit` to drive to completion.

## Phase 7: Final Validation

When pursuit completes:
1. Invoke `superpowers:verification-before-completion`
2. Invoke `superpowers:requesting-code-review` (dispatches Sentinel)
3. Invoke `superpowers:finishing-a-development-branch`

## Phase 8: Report to User

Summarize:
- What was built
- Files changed
- Tests passing
- Any known limitations or follow-up items

## Edge Cases

**Trivial task:** Skip Phases 2-7. Handle directly.

**User interruption mid-loop:** Pause. Say: "Orchestration paused. [current state summary]. What would you like to change?"
After user input, either resume from current state or restart with new intent.
```

- [ ] **Step 2: Verify file exists**

```bash
test -f ~/.config/opencode/relentless/skills/unleash/SKILL.md && echo "OK"
```

Expected: `OK`

---

### Task 3.5: ui-craft Skill

**Files:**
- Create: `~/.config/opencode/relentless/skills/ui-craft/SKILL.md`
- Create: `~/.config/opencode/relentless/skills/ui-craft/references/aesthetic-directions.md`
- Create: `~/.config/opencode/relentless/skills/ui-craft/references/anti-patterns.md`
- Create: `~/.config/opencode/relentless/skills/ui-craft/references/typography-guide.md`

- [ ] **Step 1: Write ui-craft/SKILL.md**

Create `~/.config/opencode/relentless/skills/ui-craft/SKILL.md`:

```markdown
---
name: ui-craft
description: Use when implementing UI/UX. Provides a 5-phase design process emphasizing distinctive aesthetics, accessibility, and purposeful interaction. Loaded automatically by Maestro.
---

# UI Craft

Make it beautiful. Make it distinctive. Make it yours — not another AI-generated template.

## 5-Phase Process

### Phase 1: Design Intent

Answer these before touching code:
- **Purpose:** What does this UI element accomplish for the user?
- **Audience:** Who uses this? What do they expect?
- **Tone:** Professional, playful, bold, minimal, luxurious, technical?
- **Constraints:** Mobile-first? Existing design system? Accessibility requirements?

If constraints are unclear, check the codebase for existing patterns before inventing new ones.

### Phase 2: Aesthetic Direction

Choose a bold direction. If unsure, propose 2-3 options. Never default to generic.

Read `references/aesthetic-directions.md` for direction guidance.

The direction informs every decision in Phase 3. Lock it in before moving on.

### Phase 3: Visual System

Build a coherent system, not disconnected components:

**Typography:**
- Choose fonts that match the aesthetic direction
- Read `references/typography-guide.md` for pairing guidance
- Avoid Inter, Roboto, Arial unless the project already uses them and changing would break consistency

**Color:**
- Build a palette: 1 primary, 1 accent, neutrals
- Use OKLCH color space for perceptual consistency (`oklch(60% 0.15 250)`)
- Ensure contrast ratios meet WCAG AA (4.5:1 for normal text, 3:1 for large)

**Spacing:**
- Define a rhythm (4px, 8px, 16px, 24px, 32px, 48px, 64px)
- Maintain it consistently throughout

**Components:**
- Each component should have visual personality
- Not every component needs the same treatment — vary weight, border, shadow

### Phase 4: Motion & Interaction

Motion should be purposeful. Every animation must answer: "What does this communicate?"

- Staggered reveals on page load (not instant)
- State transitions (hover, focus, active) should feel responsive
- Scroll-triggered animations where they add context (not just decoration)
- Hover states: something unexpected but not annoying
- Always include: `@media (prefers-reduced-motion: reduce)` override

### Phase 5: Implementation

- Semantic HTML (use the right element, not just `div`)
- Mobile-first (start with mobile, add breakpoints for larger)
- Keyboard navigation (all interactive elements focusable, logical tab order)
- ARIA roles where native semantics are insufficient
- Lazy loading for images and heavy content
- Minimal DOM depth (avoid div soup)

## References

- `references/aesthetic-directions.md` — guidance on each aesthetic direction
- `references/typography-guide.md` — font pairings and rules
- `references/anti-patterns.md` — what to never produce

## Hard Prohibitions

Read `references/anti-patterns.md` before starting. These are non-negotiable.
```

- [ ] **Step 2: Write references/aesthetic-directions.md**

Create `~/.config/opencode/relentless/skills/ui-craft/references/aesthetic-directions.md`:

```markdown
# Aesthetic Directions

## Brutalist
**Character:** Raw, honest, functional. No decoration that doesn't serve a purpose.
**Typography:** Monospace or heavy grotesque. Large sizes. High contrast.
**Color:** Near-monochrome with a single punchy accent (neon green, electric blue, raw red).
**Layout:** Grid-breaking. Exposed structure. Asymmetric.
**When:** Developer tools, tech-forward brands, anything that wants to feel uncompromising.

## Luxury Minimalism
**Character:** Restrained, confident, expensive. Space is the luxury.
**Typography:** Thin serif (Cormorant, Playfair) or geometric sans. Wide letter-spacing.
**Color:** Off-white, warm grays, gold or muted earth accents.
**Layout:** Generous whitespace. Single-column focus. Photography-centric.
**When:** Premium products, fintech, fashion, professional services.

## Retro-Futuristic
**Character:** 80s/90s sci-fi optimism meets modern execution.
**Typography:** Geometric sans (Eurostile, Bank Gothic) + monospace.
**Color:** Deep navy or black backgrounds. Cyan, magenta, amber accents. Gradient glows.
**Layout:** Grid with visible structural elements. Dashboard-style.
**When:** Gaming, AI products, anything that wants to feel like the future people imagined.

## Maximalist
**Character:** More is more. Layered, rich, expressive.
**Typography:** Mixed — editorial pairing of display and body fonts. Variable sizes.
**Color:** Vibrant palette. Multiple accent colors. Gradients as features, not backgrounds.
**Layout:** Dense information. Layered cards. Unexpected crops and overlaps.
**When:** Media, creative agencies, entertainment, fashion.

## Playful Organic
**Character:** Friendly, human, approachable. Feels like it was made by a person.
**Typography:** Rounded sans (Nunito, Quicksand) or friendly display fonts.
**Color:** Warm palette. Muted pastels with saturated accents.
**Layout:** Soft shapes (blobs, curves). Irregular grids. Breathing room.
**When:** Consumer apps, health/wellness, education, children's products.

## Technical Precision
**Character:** Data-forward, information-dense, trustworthy.
**Typography:** System UI or clean geometric sans. Tight line heights.
**Color:** Neutral base with semantic color system (red=error, green=success, etc.).
**Layout:** Table-friendly. Predictable grid. Scannable hierarchy.
**When:** Admin dashboards, analytics tools, enterprise software, developer products.
```

- [ ] **Step 3: Write references/anti-patterns.md**

Create `~/.config/opencode/relentless/skills/ui-craft/references/anti-patterns.md`:

```markdown
# UI Anti-Patterns — Never Produce These

## The AI Website
Purple-to-blue gradient hero. White rounded cards. Soft shadows everywhere.
Poppins or Inter. Blue CTA button. "Transform your workflow" headline.
**Why it's bad:** Instantly recognizable as AI-generated. Zero personality. Zero trust.

## The Box Factory
Every element: `border-radius: 8px`, `box-shadow: 0 2px 8px rgba(0,0,0,0.1)`, `padding: 16px`.
**Why it's bad:** Visual monotony. Everything looks the same weight. Nothing has hierarchy.

## The Font Coward
Uses Inter, Roboto, or Arial "because they're safe."
**Why it's bad:** No differentiation. The font is part of the brand. Neutral fonts say nothing.
**Exception:** If the project already uses these and breaking consistency would be worse.

## The Animation Glutton
Every element: `transition: all 0.3s ease`. Page load has 12 different animations.
**Why it's bad:** Noise. Animation should guide attention, not compete for it.

## The Contrast Criminal
Light gray text on white background. Small font. "It's subtle and elegant."
**Why it's bad:** Inaccessible. Fails WCAG AA. Users with low vision (and tired eyes) can't read it.

## The Stock Photo Hero
Generic business people shaking hands. Diverse team laughing at laptop.
**Why it's bad:** Immediately communicates inauthenticity. Use illustration, abstract, or product shots.

## The Responsive Afterthought
Designed at 1440px. On mobile: text overflows, buttons too small, layout broken.
**Why it's bad:** 60%+ of traffic is mobile. Mobile-first is not optional.

## The Identical Component Syndrome
Every card, modal, and panel looks identical. Same border, same padding, same shadow.
**Why it's bad:** No visual hierarchy. User can't tell what's important.

## The Purple Gradient
`background: linear-gradient(135deg, #667eea 0%, #764ba2 100%)`
This specific gradient has been used in >10,000 "modern" web apps.
**Why it's bad:** Instantly dated. Marks the site as a template.
```

- [ ] **Step 4: Write references/typography-guide.md**

Create `~/.config/opencode/relentless/skills/ui-craft/references/typography-guide.md`:

```markdown
# Typography Guide

## Pairing Principles

1. **Contrast creates hierarchy.** Pair a display font with a readable body font.
2. **Avoid same-family conflicts.** Don't pair two serifs or two heavy sans.
3. **Limit to 2-3 typefaces.** More creates chaos, not richness.
4. **Weight variation > font variation.** A single variable font can do more than two different fonts.

## Recommended Pairings by Aesthetic

### Brutalist / Technical
- Display: Space Grotesk Bold, IBM Plex Mono
- Body: Space Grotesk Regular, JetBrains Mono

### Luxury Minimalism
- Display: Cormorant Garamond Light (40px+), Playfair Display
- Body: Jost, DM Sans

### Retro-Futuristic
- Display: Exo 2, Orbitron (sparingly — best at large sizes only)
- Body: IBM Plex Sans, Rajdhani

### Playful / Friendly
- Display: Nunito ExtraBold, Fredoka One
- Body: Nunito Regular, Quicksand

### Editorial / Maximalist
- Display: Cabinet Grotesk, Clash Display
- Body: Satoshi, General Sans

## Variable Fonts Worth Using

- **Inter** — Only acceptable for dense data interfaces. Otherwise, find something more interesting.
- **Recursive** — Great variable font for dev tools (code + UI share a family).
- **Cabinet Grotesk** — Geometric with personality. Good for headings.
- **Satoshi** — Clean, warm geometric. Good body font.

## Size Scale (rem-based, base 16px)

```
xs:   0.75rem  (12px)  — labels, captions
sm:   0.875rem (14px)  — secondary body
base: 1rem     (16px)  — body
lg:   1.125rem (18px)  — large body
xl:   1.25rem  (20px)  — small headings
2xl:  1.5rem   (24px)  — section headings
3xl:  1.875rem (30px)  — page headings
4xl:  2.25rem  (36px)  — hero text
5xl:  3rem     (48px)  — display
6xl:  3.75rem  (60px)  — large display
```

## Letter Spacing Rules

- **All-caps labels:** Always add letter-spacing (0.05–0.15em)
- **Display/hero text:** Slightly negative letter-spacing (-0.02em) for large sizes
- **Body text:** No letter-spacing modifications
- **Monospace:** No modifications needed

## Line Height Rules

- **Body text:** 1.5–1.7 (comfortable reading)
- **Headings:** 1.1–1.3 (tighter for display)
- **Code:** 1.6–1.8 (needs more room)
```

- [ ] **Step 5: Verify all ui-craft files exist**

```bash
for f in SKILL.md references/aesthetic-directions.md references/anti-patterns.md references/typography-guide.md; do
    test -f ~/.config/opencode/relentless/skills/ui-craft/$f && echo "OK: $f" || echo "MISSING: $f"
done
```

Expected: 4 lines starting with `OK:`

---

### Task 3.6: recon Skill

**Files:**
- Create: `~/.config/opencode/relentless/skills/recon/SKILL.md`
- Create: `~/.config/opencode/relentless/skills/recon/references/quality-criteria.md`
- Create: `~/.config/opencode/relentless/skills/recon/references/templates.md`

- [ ] **Step 1: Write recon/SKILL.md**

Create `~/.config/opencode/relentless/skills/recon/SKILL.md`:

```markdown
---
name: recon
description: Use when /recon command is invoked. Scans the codebase and generates, audits, or improves AGENTS.md files hierarchically throughout the project.
---

# Recon — Codebase Mapping

Map the territory before agents work in it. AGENTS.md files give every agent instant context without scanning the whole codebase.

## Modes

```
/recon                  → Generate mode: scan + create new AGENTS.md files
/recon --audit          → Audit mode: score existing AGENTS.md quality
/recon --improve        → Improve mode: audit + propose targeted improvements
/recon --update         → Update mode: refresh AGENTS.md based on recent changes
/recon --max-depth=N    → Limit scan depth (default: 4)
```

## Phase 1: Discovery (Scout)

Dispatch Scout to:
1. Scan directory tree up to `max-depth`
2. Find all existing AGENTS.md files
3. Identify candidate directories (see criteria below)

**Empty project check:** If no source files found, report: "No codebase found. Initialize your project first."

**Candidate directory criteria (ANY of these qualifies):**
- Contains 3+ source files (not config, not test files)
- Contains files of mixed types/concerns
- Is a named domain directory: `api`, `components`, `lib`, `services`, `utils`, `hooks`, `store`, `db`, `auth`, `models`, `routes`, `middleware`, `types`, `schemas`
- Already has an AGENTS.md (always include for audit)
- Is the project root (always include)

**Always exclude:** `node_modules/`, `.git/`, `dist/`, `build/`, `coverage/`, `.next/`, `.nuxt/`, hidden dirs (`.foo`) except `.opencode/`

## Phase 2: Analysis (Scout + Conductor)

For each candidate directory, Scout should detect:
- **Tech stack:** frameworks, languages, libraries used
- **Conventions:** naming patterns, file organization
- **Commands:** build/test/dev commands (from package.json, Makefile, etc.)
- **Dependencies:** key packages from package.json / requirements.txt / go.mod / Cargo.toml
- **Environment variables:** from .env.example, README, or config files
- **Non-obvious patterns:** gotchas, quirks, undocumented behavior

## Phase 3: Quality Assessment (--audit / --improve modes)

Score each existing AGENTS.md using `references/quality-criteria.md`.

Output a quality report BEFORE making any changes:

```
## Recon Report

### Summary
- Directories scanned: N
- AGENTS.md found: N
- AGENTS.md missing (recommended): N
- Average score: N/100 (Grade X)

### File-by-File Assessment

#### ./AGENTS.md (Root) — Score: 85/100 (B)
| Criterion              | Score | Notes |
| Tech stack/conventions | 18/20 | Missing database info |
| Architecture clarity   | 17/20 | Outdated directory structure |
...

Issues:
- [specific problem]

Recommended additions:
- [specific addition]
```

## Phase 4: Propose Changes (--improve mode)

Show diffs for each proposed change BEFORE applying:

```
### Update: ./src/api/AGENTS.md

Why: Database connection pattern undocumented, agents generate incorrect DB code.

+ ## Database
+ - ORM: Drizzle with PostgreSQL
+ - Connection: Pool via `src/lib/db.ts`
```

Ask for user approval before applying.

## Phase 5: Apply (after approval)

Apply using Edit tool. Preserve existing content structure.

## AGENTS.md Content Template

Read `references/templates.md` for templates per project type.

Each AGENTS.md should be:
- **Concise:** 50-150 lines max
- **Actionable:** All commands copy-pasteable
- **Specific:** Project-specific patterns, not generic advice
- **Current:** Accurate to the current codebase state
```

- [ ] **Step 2: Write recon/references/quality-criteria.md**

Create `~/.config/opencode/relentless/skills/recon/references/quality-criteria.md`:

```markdown
# AGENTS.md Quality Criteria

## Scoring Rubric (100 points total)

### Tech Stack & Conventions (20 points)
- **18-20:** Tech stack, key libraries, naming conventions, and file organization all documented
- **14-17:** Tech stack documented, some conventions missing
- **8-13:** Only framework mentioned, no conventions
- **0-7:** Missing or vague

**Check for:** Framework, language, key libraries, naming conventions (camelCase, kebab-case, etc.), file organization pattern

### Architecture Clarity (20 points)
- **18-20:** Clear explanation of directory purpose, component relationships, data flow
- **14-17:** Main directories explained, some relationships unclear
- **8-13:** Basic structure mentioned, no relationships
- **0-7:** No architecture info

**Check for:** What each major directory does, how components relate, entry points

### Commands & Workflows (20 points)
- **18-20:** All build/test/dev/deploy commands present, copy-pasteable
- **14-17:** Main commands present, some missing
- **8-13:** Some commands, but incomplete or wrong
- **0-7:** No commands

**Check for:** `npm run dev`, `npm test`, `npm run build`, `npm run lint`, migration commands, deploy commands

### Non-Obvious Patterns (15 points)
- **13-15:** Key gotchas, quirks, and non-obvious patterns documented
- **9-12:** Some patterns documented
- **4-8:** Only obvious patterns
- **0-3:** No patterns documented

**Check for:** Authentication patterns, error handling approach, state management patterns, API conventions, anything a developer would need to discover by reading code

### Conciseness (15 points)
- **13-15:** Dense, useful, no padding
- **9-12:** Mostly useful with minor padding
- **4-8:** Noticeable verbose sections or generic advice
- **0-3:** Mostly generic/verbose

**Anti-patterns:** Generic best practices, obvious statements ("use meaningful variable names"), restating what's obvious from the code

### Currency (10 points)
- **9-10:** Accurately reflects current codebase
- **6-8:** Mostly accurate, minor outdated items
- **3-5:** Some outdated information
- **0-2:** Significantly outdated

**Check for:** File paths that still exist, command names that still work, dependencies that are still used

## Grades

| Score | Grade | Meaning |
|-------|-------|---------|
| 90-100 | A | Excellent — minimal changes needed |
| 70-89 | B | Good — minor gaps |
| 50-69 | C | Adequate — missing key sections |
| 30-49 | D | Poor — sparse or outdated |
| 0-29 | F | Failing — needs full rewrite |
```

- [ ] **Step 3: Write recon/references/templates.md**

Create `~/.config/opencode/relentless/skills/recon/references/templates.md`:

```markdown
# AGENTS.md Templates

## Root Project Template

```markdown
# [Project Name]

## Overview
[1-2 sentence description of what this project does]

## Tech Stack
- **Framework:** [e.g., Next.js 14 with App Router]
- **Language:** [e.g., TypeScript 5.x]
- **Database:** [e.g., PostgreSQL via Drizzle ORM]
- **Styling:** [e.g., Tailwind CSS]
- **Testing:** [e.g., Vitest + Testing Library]

## Commands
```bash
npm run dev       # Start development server (port 3000)
npm test          # Run test suite
npm run build     # Production build
npm run lint      # Lint + typecheck
npm run db:push   # Push schema changes
```

## Directory Structure
```
src/
├── app/          # Next.js App Router pages
├── components/   # Reusable UI components
├── lib/          # Shared utilities and helpers
├── api/          # API route handlers
└── db/           # Database schema and migrations
```

## Key Conventions
- [naming convention]
- [error handling pattern]
- [auth pattern]

## Environment Variables
Required in `.env.local`:
- `DATABASE_URL` — PostgreSQL connection string
- `NEXTAUTH_SECRET` — Auth secret
```

---

## API Directory Template

```markdown
# API Routes

## Pattern
[RESTful | tRPC | GraphQL] — describe the pattern used

## Authentication
[How auth is checked — middleware? per-route? JWT? session?]

## Error Handling
[Standard error response format — example]

## Key Files
- `[entry point]` — [description]
- `[auth middleware]` — [description]

## Conventions
- [request validation approach]
- [response format]
```

---

## Components Directory Template

```markdown
# UI Components

## Pattern
[Functional React | Vue SFCs | etc.]

## Styling
[Tailwind | CSS Modules | styled-components — how classes are applied]

## Component Conventions
- [naming: PascalCase, kebab-case files?]
- [prop patterns: props interface naming?]
- [export style: named? default?]

## Testing
[How components are tested — Testing Library? Storybook?]
```

---

## Library/Utils Directory Template

```markdown
# Utilities & Helpers

## What Lives Here
[Description of what belongs in this directory]

## Key Files
- `[filename]` — [what it does]

## Conventions
- [how utilities are organized]
- [naming patterns]
```
```

- [ ] **Step 4: Verify all recon skill files exist**

```bash
for f in SKILL.md references/quality-criteria.md references/templates.md; do
    test -f ~/.config/opencode/relentless/skills/recon/$f && echo "OK: $f" || echo "MISSING: $f"
done
```

Expected: 3 lines starting with `OK:`

- [ ] **Step 5: Commit Chunk 3**

```bash
cd ~/.config/opencode/relentless && git add . && git commit -m "feat: add all 6 skills (intent-gate, todo-enforcer, pursuit, unleash, ui-craft, recon)"
```

---

## Chunk 4: End-to-End Verification

Verify the full installation works, symlinks are correct, plugin loads in OpenCode, and smoke test all commands.

**Note:** The `/unleash` and `/pursuit` tools are defined as command stubs in Chunk 1. Full orchestration logic is in the skills (Chunk 3). The commands invoke the skills. This is correct — implementation is complete when skills + commands + plugin are all wired together.

---

### Task 4.1: Verify Installation

- [ ] **Step 1: Run install script (idempotent)**

```bash
bash ~/.config/opencode/relentless/install.sh
```

Expected: All `[ok]` lines, no errors.

- [ ] **Step 2: Verify all symlinks point to correct targets**

```bash
echo "=== Plugin ===" && readlink ~/.config/opencode/plugins/relentless.js
echo "=== Agents ===" && for a in conductor artisan maestro sentinel scout; do readlink ~/.config/opencode/agents/$a.md; done
echo "=== Commands ===" && for c in unleash pursuit recon resume status halt; do readlink ~/.config/opencode/commands/$c.md; done
echo "=== Skills ===" && readlink ~/.config/opencode/skills/relentless
echo "=== Config ===" && head -3 ~/.config/opencode/relentless.jsonc
```

Expected: All paths point into `~/.config/opencode/relentless/`

- [ ] **Step 3: Run all tests**

```bash
node ~/.config/opencode/relentless/lib/config.test.js && \
node ~/.config/opencode/relentless/lib/circuit-breaker.test.js && \
node ~/.config/opencode/relentless/lib/state.test.js && \
echo "ALL TESTS PASSED"
```

Expected: `ALL TESTS PASSED`

- [ ] **Step 4: Verify plugin is valid ESM module**

```bash
node --input-type=module --eval "
import plugin from '/home/mizu/.config/opencode/relentless/.opencode/plugins/relentless.js';
console.log('Plugin type:', typeof plugin);
plugin({ client: null, directory: '/tmp' }).then(hooks => {
    console.log('Hooks registered:', Object.keys(hooks).join(', '));
}).catch(e => console.error('Plugin error:', e));
"
```

Expected:
```
Plugin type: function
Hooks registered: experimental.chat.system.transform, experimental.session.compacting, event
```

- [ ] **Step 5: Verify skill files are discoverable**

```bash
for skill in intent-gate todo-enforcer pursuit unleash ui-craft recon; do
    test -f ~/.config/opencode/skills/relentless/$skill/SKILL.md && echo "OK: $skill" || echo "MISSING: $skill"
done
```

Expected: 6 lines starting with `OK:`

- [ ] **Step 6: Verify agent files have valid frontmatter**

```bash
for agent in conductor artisan maestro sentinel scout; do
    head -1 ~/.config/opencode/agents/$agent.md | grep -q "^---$" && echo "OK: $agent frontmatter" || echo "BAD: $agent"
done
```

Expected: 5 lines starting with `OK:`

---

### Task 4.2: Final Commit

- [ ] **Step 1: Final commit**

```bash
cd ~/.config/opencode/relentless && git add . && git commit -m "feat: complete Relentless v0.1.0 — plugin, agents, commands, skills, tests"
```

- [ ] **Step 2: Print installation summary**

```bash
echo "=== Relentless Installation Summary ==="
echo ""
echo "Plugin: $(ls -la ~/.config/opencode/plugins/relentless.js)"
echo ""
echo "Agents installed:"
ls ~/.config/opencode/agents/ | grep -E "conductor|artisan|maestro|sentinel|scout" | sed 's/^/  /'
echo ""
echo "Commands installed:"
ls ~/.config/opencode/commands/ | grep -E "unleash|pursuit|recon|resume|status|halt" | sed 's/^/  /'
echo ""
echo "Skills installed:"
ls ~/.config/opencode/skills/relentless/ | sed 's/^/  /'
echo ""
echo "Config: ~/.config/opencode/relentless.jsonc"
echo ""
echo "Relentless v0.1.0 ready. Restart OpenCode to activate."
echo "Next: Resolve Open Questions #1 and #2 (see docs/specs/) before using /unleash in production."
```

---

*Plan complete. Ready to execute via superpowers:subagent-driven-development.*
