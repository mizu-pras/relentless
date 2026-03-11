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
