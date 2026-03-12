---
name: unleash
description: "Use when /unleash command is invoked. Orchestrates the full autonomous pipeline: intent analysis, planning, parallel dispatch, pursuit loop, final validation."
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
   - `zai-coding-plan/glm-5` (Scout)
   - If any missing: warn user and ask whether to continue with available models or abort

## Phase 1: Intent Analysis

Apply `relentless:intent-gate` to the task:
- Classify intent type
- Detect ambiguity — if ambiguous, ask ONE clarifying question and wait
- If trivial: handle directly without orchestration
- If clear and non-trivial: proceed to Phase 2

## Phase 2: Planning (Conductor)

Activate as Conductor. Then:
1. Invoke `relentless:brainstorming` if task complexity warrants it (architectural decisions, unclear scope)
2. Invoke `relentless:writing-plans` to create a structured implementation plan
3. Save the plan summary to `.relentless/current-pursuit.json`
4. Create todos for each planned step (use TodoWrite)

**Remember:** You (Conductor) are the proxy user for relentless skill approval gates. Do not escalate brainstorming or plan approval to the human user.

## Phase 3: Scout Reconnaissance

Dispatch scout to understand the codebase:
- What files exist relevant to this task?
- What patterns and conventions are used?
- Are there existing tests? Build steps?

### Pre-Implementation Validation

Scout MUST verify the following BEFORE Conductor dispatches any implementation agents:

1. **Dependency Verification:**
   - All packages referenced in the plan exist in `package.json`
   - Flag any missing packages: "MISSING DEPENDENCY: `package-name` referenced in plan but not in package.json"
   - Suggest install commands for missing packages

2. **Directory Structure Validation:**
   - Verify planned directory structure matches existing project layout
   - Flag conflicts: route groups vs segments, module boundaries, etc.
   - Check that import paths in the plan resolve to existing or planned files

3. **Import Resolution Check:**
   - Verify that components/modules referenced by `@/` or relative imports actually exist
   - Flag phantom imports: "PHANTOM IMPORT: `@/components/ui/Button` -- file does not exist"
   - Distinguish between "will be created by this plan" and "assumed to exist"

4. **Framework Gotcha Scan:**
   - Check `.relentless/lessons.jsonl` for known issues with the project's framework stack
   - Cross-reference plan's framework usage patterns against known gotchas
   - Report any matches: "GOTCHA WARNING: [framework] [issue] -- see lesson [id]"

**Scout reports these findings to Conductor. If Critical issues found (missing deps, phantom imports), Conductor MUST resolve them before dispatching implementation agents.**

Use Scout's findings to refine file assignments in the plan.

**Shared Context:** Scout should write its findings to the shared knowledge base so other agents can reuse them without re-scanning:
- `writeMarkdownContext(dir, "project-map", findings)` — codebase structure and relevant files
- `writeMarkdownContext(dir, "conventions", patterns)` — coding conventions detected
- `writeSummary(dir, { file, summary, agent, timestamp })` — per-file summaries for handoff compression

These live in `.relentless/shared-context/` and are readable by all agents.

**File Summaries for Handoff Compression:** For each relevant file Scout reads, write a 1-2 sentence summary via `writeSummary()`. These summaries will be embedded in agent handoffs so agents don't need to re-read every file.

## Phase 4: File Ownership Assignment

Before any parallel dispatch, pre-assign which files each agent may touch:
- No two agents receive the same file
- If a task requires a shared file, sequence it after the first agent finishes

## Phase 4b: Parallel Dispatch Analysis

Before dispatching agents, Conductor MUST analyze the plan's dependency graph to maximize parallelism:

### Dependency Classification

For each task in the plan, classify its dependencies:

| Dependency Type | Example | Can Parallelize? |
|----------------|---------|-----------------|
| **Type dependency** | Frontend uses backend types | No -- must sequence |
| **Import dependency** | Component imports utility | No -- must sequence |
| **Data dependency** | Page fetches from API | No -- must sequence |
| **No dependency** | Layout components, static pages, config files | Yes -- parallelize |
| **Shared file** | Multiple tasks touch same file | No -- sequence by file |

### Parallel Track Discovery

1. List all tasks and their file inputs/outputs
2. Build dependency edges: Task A -> Task B if B reads files A writes
3. Identify independent subgraphs -- these can run in parallel
4. Assign each parallel track to a separate agent

### Common Parallel Opportunities

| Track A (Artisan) | Track B (Maestro/Artisan) | Prerequisite |
|-------------------|---------------------------|-------------|
| Backend routes/logic | Layout components, static UI | None |
| Database schema + seed | Chart/visualization components | None |
| Auth middleware | Shared utilities, helpers | None |
| API implementation | Test scaffolding (structure only) | None |

### Merge Point

After parallel tracks complete, sequential work handles tasks that depend on both tracks (e.g., pages that use both backend types and UI components).

**Rule:** If Conductor dispatches all tasks sequentially despite parallel opportunities, it MUST document why parallelism was not possible (e.g., "all tasks share the same files").

## Phase 5: Parallel Dispatch

OpenCode dispatches multiple Task tool calls in a single message **in parallel** (via `Promise.all`). To dispatch concurrently, include all Task tool calls in a single assistant response.

Dispatch agents by category:
- `deep` tasks → artisan (include handoff schema) — artisan should load `relentless:test-driven-development`
- `visual` tasks → maestro (include handoff schema) — maestro should load `relentless:ui-craft`
- `reason` tasks → sentinel (include handoff schema) — sentinel should load `relentless:systematic-debugging`
- `quick` tasks → scout (read-only, no skill loading required — scout is skill-free by design)

**Agent skill loading:** Include the relevant skill name in the handoff constraints so agents load them explicitly, not by convention. Scout is exempt — it only reads, never writes.

Every handoff MUST include:
```json
{
  "task": "specific goal",
  "context_summary": {
    "src/relevant-file.ts": "1-2 sentence summary of what this file does"
  },
  "assigned_files": ["files this agent may touch"],
  "constraints": ["Skip brainstorming — plan provided", "Only touch assigned_files", "Check .relentless/halt"],
  "expected_output": "deliverable description",
  "related_todos": ["T-XXX"],
  "approach": "tdd",
  "shared_context": "Read .relentless/shared-context/ for project-map, conventions, and prior decisions before starting"
}
```

**Handoff Compression:** Use `context_summary` instead of `context_files`:
- Embed pre-digested file summaries (from Scout's `writeSummary()` or Conductor's own reading) directly in the handoff
- Agents use summaries to understand context without re-reading files
- If an agent needs more detail than the summary provides, it reads the file directly
- This saves **10-30x tokens** vs. every agent independently reading the same files

**Shared Context Protocol:** Agents should:
- **Read** `.relentless/shared-context/project-map.md` and `conventions.md` before starting work (saves re-scanning)
- **Append** architectural decisions via `appendDecision()` to `decisions.jsonl`
- **Append** errors encountered via `appendError()` to `error-log.jsonl`

## Phase 6: Pursuit Loop

Apply `relentless:pursuit` to drive to completion.

## Phase 7: Final Validation (MANDATORY)

This phase is NON-NEGOTIABLE. Skipping it was identified as a critical gap in performance analysis.

When pursuit loop completes:

1. **Verification gate:**
   - Invoke `relentless:verification-before-completion`
   - Run ALL gate commands: typecheck, build, test
   - If any fail: return to pursuit loop with fix todos

2. **Sentinel security review (MANDATORY):**
   - Invoke `relentless:requesting-code-review` to dispatch Sentinel
   - Sentinel checklist:
     - [ ] Authentication/authorization on all endpoints
     - [ ] Input validation on all user inputs
     - [ ] No duplicated utility code (DRY)
     - [ ] Error handling covers edge cases
     - [ ] No hardcoded secrets or credentials
     - [ ] Rate limiting on auth endpoints
   - If Sentinel finds Critical issues: return to pursuit loop with fix todos
   - Phase 7 does NOT complete until Sentinel approves

3. **Branch completion:**
   - Invoke `relentless:finishing-a-development-branch`
   - Only after Sentinel approval

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
