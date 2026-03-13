---
name: branching
description: Manage experimental pursuit branches with git worktrees, including create, switch, merge, and abandon workflows.
---

# Pursuit Branching

## Overview

Pursuit branching enables parallel exploration of the same problem space without losing progress. Each pursuit branch maps to a dedicated git branch and worktree, while branch metadata is tracked in `.relentless/branches.json`.

Use this skill when you need to:
- Try a risky alternative implementation
- Split a pursuit into concurrent experiments
- Pause one direction and continue another

Core rule: do not exceed branch capacity, and always keep registry state aligned with git worktree reality.

## Branch Model

Each branch record tracks:
- Branch id (`branch-<timestamp>`)
- Human-readable name and full task description
- Optional parent pursuit id
- Git branch name (`pursuit/<sanitized-task>`)
- Absolute worktree path (`.worktrees/pursuit-<id>`)
- Status (`active`, `paused`, `merged`, `abandoned`)

Registry constraints:
- Maximum 3 concurrent open branches by default (`active` + `paused`)
- Exactly one `active_branch` at a time (or none)
- Names must be unique after sanitization

## Before Any Branch Action

1. Check halt flag:
   - If `.relentless/halt` exists, stop immediately.
2. Read `.relentless/branches.json`:
   - If missing, treat as `{ branches: [], max_branches: 3 }`.
3. Validate target branch id if action is switch/merge/abandon.

## Workflow: Create Branch

1. Validate open branch count (`active` + `paused`) is below max.
2. Sanitize task for branch name and verify uniqueness.
3. Create registry entry via branching state API:
   - `id = branch-${Date.now()}`
   - `git_branch = pursuit/<sanitized-task>`
   - `worktree_path = <project>/.worktrees/pursuit-<id>`
4. Pause current active branch in registry (if one exists).
5. Set new branch as active.
6. Invoke `using-git-worktrees` skill to create real worktree and git branch.
7. Copy or initialize pursuit state for the new branch context.

## Workflow: Switch Branch

1. Verify target exists and is not `merged` or `abandoned`.
2. Mark current active branch as `paused`.
3. Mark target branch as `active` and set `active_branch`.
4. Switch shell/editor context to target worktree path.
5. Load pursuit state associated with that branch.

## Workflow: Merge Branch

1. Ensure branch work is integrated into intended destination branch.
2. Mark branch status as `merged` in registry.
3. If merged branch was active, clear `active_branch` or switch to another open branch.
4. Optionally remove worktree via git once no longer needed.
5. Keep audit history in registry; do not delete merged records.

## Workflow: Abandon Branch

1. Confirm branch can be safely dropped.
2. Mark status as `abandoned`.
3. If branch was active, clear `active_branch`.
4. Remove worktree directory and git worktree reference.
5. Keep abandoned record for traceability.

## Integration with using-git-worktrees

Branching owns registry state. `using-git-worktrees` owns physical workspace creation and isolation checks.

Required integration sequence:
1. Create registry entry first
2. Invoke `using-git-worktrees` for setup
3. If setup fails, roll branch back to `abandoned` or remove the record

Always use `.worktrees/` when present and git-ignored.

## Error Handling

Handle these failures explicitly:
- Max branch limit reached: block create with a clear error
- Duplicate sanitized name: block create with rename guidance
- Missing branch id: fail switch/merge/abandon with "Branch not found"
- Corrupt registry JSON: fall back to empty registry and warn
- Worktree creation failure: leave clear recovery instructions

## Example

1. `/branch "compare retry strategies"`
2. Registry creates `branch-1700000000000` with `pursuit/compare-retry-strategies`
3. Worktree created at `.worktrees/pursuit-branch-1700000000000`
4. Previous active branch becomes `paused`
5. `/branches` confirms active marker on new branch
6. `/switch branch-1699999999000` returns to prior approach

## Output Expectations

When listing branches, provide:
- Table rows with id, name, status, task, and created date
- `*` marker on active branch name
- Capacity summary (for example, `2/3 (1 slot available)`)
