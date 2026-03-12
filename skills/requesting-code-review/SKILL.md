---
name: requesting-code-review
source: Forked from superpowers by Jesse Vincent (MIT License)
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements
---

# Requesting Code Review

Dispatch relentless:code-reviewer subagent to catch issues before they cascade.

**Core principle:** Review early, review often.

**Relentless-specific requirements:**
- Check `.relentless/halt` before dispatching review
- In relentless context, code review is dispatched to Sentinel agent by Conductor
- Sentinel's findings are authority and override Artisan/Maestro preferences

## When to Request Review

**Mandatory:**
- After each task in subagent-driven development
- After completing major feature
- Before merge to main

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Request

**1. Check halt state:**
```bash
test -f .relentless/halt && echo "HALT present - stop immediately"
```

**2. Get git SHAs:**
```bash
BASE_SHA=$(git rev-parse HEAD~1)  # or origin/main
HEAD_SHA=$(git rev-parse HEAD)
```

**3. Dispatch code-reviewer subagent:**

Use Task tool with relentless:code-reviewer type, fill template at `code-reviewer.md`

**Placeholders:**
- `{WHAT_WAS_IMPLEMENTED}` - What you just built
- `{PLAN_OR_REQUIREMENTS}` - What it should do
- `{BASE_SHA}` - Starting commit
- `{HEAD_SHA}` - Ending commit
- `{DESCRIPTION}` - Brief summary

**4. Act on feedback using `relentless:receiving-code-review`:**

**REQUIRED:** When Sentinel returns findings, the receiving agent MUST invoke `relentless:receiving-code-review` to process the feedback properly. This ensures:
- Technical evaluation over performative agreement
- Proper severity triage (Critical → mandatory, Important → before proceeding, Advisory → backlog)
- Reasoned pushback with evidence when findings are incorrect
- One-at-a-time implementation with testing

Severity handling:
- Fix Critical issues immediately — no pushback allowed
- Fix Important issues before proceeding — reasoned pushback allowed only with evidence
- Note Advisory issues for later — implement if time permits
- Treat Sentinel findings as authoritative in relentless pursuit flow

## Example

```
[Just completed Task 2: Add verification function]

You: Let me request code review before proceeding.

BASE_SHA=$(git log --oneline | grep "Task 1" | head -1 | awk '{print $1}')
HEAD_SHA=$(git rev-parse HEAD)

[Dispatch relentless:code-reviewer subagent]
  WHAT_WAS_IMPLEMENTED: Verification and repair functions for conversation index
  PLAN_OR_REQUIREMENTS: Task 2 from docs/relentless/plans/deployment-plan.md
  BASE_SHA: a7981ec
  HEAD_SHA: 3df7661
  DESCRIPTION: Added verifyIndex() and repairIndex() with 4 issue types

[Subagent returns]:
  Strengths: Clean architecture, real tests
  Issues:
    Important: Missing progress indicators
    Minor: Magic number (100) for reporting interval
  Assessment: Ready to proceed

You: [Fix progress indicators]
[Continue to Task 3]
```

## Integration with Workflows

**Subagent-Driven Development:**
- Review after EACH task
- Catch issues before they compound
- Fix before moving to next task

**Executing Plans:**
- Review after each batch (3 tasks)
- Get feedback, apply, continue

**Ad-Hoc Development:**
- Review before merge
- Review when stuck

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

**If reviewer wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification

See template at: requesting-code-review/code-reviewer.md

## Integration

**Called by:**
- **unleash** (Phase 7) — dispatches Sentinel for final review
- Can be invoked ad-hoc during development

**Chains to:**
- **relentless:receiving-code-review** — REQUIRED: receiving agent must invoke this to process Sentinel findings

**Called within:**
- **pursuit loop** — when `review_cadence` is set (per-task, per-batch, or final-only)
