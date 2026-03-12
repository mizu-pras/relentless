---
name: writing-plans
source: Forked from superpowers by Jesse Vincent (MIT License)
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. TDD. Frequent commits.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Context:** This should be run in a dedicated worktree (created by brainstorming skill).

**Save plans to:** `docs/relentless/plans/YYYY-MM-DD-<feature-name>.md`
- (User preferences for plan location override this default)

## Scope Check

If the spec covers multiple independent subsystems, it should have been broken into sub-project specs during brainstorming. If it wasn't, suggest breaking this into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

## File Structure

Before defining tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- You reason best about code you can hold in context at once, and your edits are more reliable when files are focused. Prefer smaller, focused files over large ones that do too much.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If the codebase uses large files, don't unilaterally restructure - but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.

This structure informs the task decomposition. Each task should produce self-contained changes that make sense independently.

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Write the failing test" - step
- "Run it to make sure it fails" - step
- "Implement the minimal code to make the test pass" - step
- "Run the tests and make sure they pass" - step
- "Commit" - step

## Plan Content Rules

### No Full Implementation Code in Plans

Plans should contain **architecture, interfaces, and acceptance criteria** — not implementation code.

| Allowed in Plans | NOT Allowed in Plans |
|-----------------|---------------------|
| Interface signatures | Full function implementations |
| Type definitions | Copy-paste-ready code blocks |
| Pseudocode with comments | Exact file contents to create |
| API endpoint shapes | Component render logic |
| Database schema | Business logic implementations |
| Test assertions (what to verify) | Test implementations (how to verify) |

**Code snippets ARE allowed** when:
- Labeled explicitly as "reference" or "example"
- Showing a pattern, not an exact implementation
- Demonstrating an API or library usage pattern
- Maximum 10-15 lines per snippet

**Why:** When plans contain exact code, agents copy without considering runtime context. This caused:
- Route group confusion (plan said `(dashboard)` but didn't note it doesn't create URL segments)
- Missing dependency detection (plan assumed packages were installed)
- Framework misapplication (plan code didn't match actual framework behavior)

### Acceptance Criteria Per Chunk

Every chunk MUST end with an acceptance gate:

```markdown
### Chunk N Acceptance Gate
- [ ] `tsc --noEmit` passes
- [ ] `npm run build` passes  
- [ ] `npm test` passes
- [ ] [chunk-specific criteria]
```

Chunks without acceptance gates are incomplete plans.

### Framework Gotchas Section

Plans involving established frameworks MUST include a gotchas section:

```markdown
## Known Framework Gotchas

| Framework | Gotcha | Impact |
|-----------|--------|--------|
| Next.js App Router | Route groups `(name)` don't create URL segments | URLs won't match component paths |
| Prisma | `npx prisma generate` needed after schema change | Types won't match |
| tRPC | Client types must be regenerated after router changes | Type errors |
```

Populate this by consulting framework documentation or lessons from `.relentless/lessons.jsonl`.

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED: Use relentless pursuit loop for execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

---
```

## Task Structure

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`
- Test: `tests/exact/path/to/test.py`

- [ ] **Step 1: Write the failing test**

```python
def test_specific_behavior():
    result = function(input)
    assert result == expected
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest tests/path/test.py::test_name -v`
Expected: FAIL with "function not defined"

- [ ] **Step 3: Write minimal implementation**

```python
def function(input):
    return expected
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pytest tests/path/test.py::test_name -v`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add tests/path/test.py src/path/file.py
git commit -m "feat: add specific feature"
```
````

**Important:** Code in task steps should be pseudocode or interface-level, not full implementations. Use the `relentless:chunk-gate` skill to verify each chunk after implementation.

## Remember
- Exact file paths always
- Architecture and interfaces in plan, not full implementation code (see Plan Content Rules)
- Reference code snippets labeled as "reference", max 10-15 lines each
- Exact commands with expected output
- Reference relevant skills with @ syntax
- Include file ownership assignments for parallel dispatch
- Include handoff schema (`task`, `assigned_files`, `constraints`, `expected_output`)
- Check `.relentless/halt` before proceeding
- DRY, YAGNI, TDD, frequent commits

## Plan Review Loop

After completing each chunk of the plan:

1. Dispatch plan-document-reviewer subagent (see plan-document-reviewer-prompt.md) for the current chunk
   - Provide: chunk content, path to spec document
2. If ❌ Issues Found:
   - Fix the issues in the chunk
   - Re-dispatch reviewer for that chunk
   - Repeat until ✅ Approved
3. If ✅ Approved: proceed to next chunk (or execution handoff if last chunk)

**Chunk boundaries:** Use `## Chunk N: <name>` headings to delimit chunks. Each chunk should be ≤1000 lines and logically self-contained.

**Review loop guidance:**
- Same agent that wrote the plan fixes it (preserves context)
- If loop exceeds 5 iterations, surface to human for guidance
- Reviewers are advisory - explain disagreements if you believe feedback is incorrect

## Execution Handoff

After saving the plan:

**"Plan complete and saved to `docs/relentless/plans/<filename>.md`. Ready to execute?"**

When invoked by Conductor, Conductor reviews and approves the plan. No escalation to a human reviewer is required.
