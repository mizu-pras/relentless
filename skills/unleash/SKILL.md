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

## Phase 7: Final Validation

When pursuit completes:
1. Invoke `relentless:verification-before-completion`
2. Invoke `relentless:requesting-code-review` (dispatches Sentinel)
3. Invoke `relentless:finishing-a-development-branch`

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
