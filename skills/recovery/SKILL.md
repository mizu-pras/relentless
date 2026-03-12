---
name: recovery
description: "Structured recovery from failed or stuck pursuits. Cleans state, offers rollback, preserves lessons."
---

# Recovery - Rollback and State Cleanup

Recover safely from failed or stuck pursuits while preserving useful context and lessons.

## Modes

| Flag | Behavior | Default |
|------|----------|---------|
| `--report` | Diagnose the latest failed or active pursuit and suggest recovery level | yes (default) |
| `--soft` | Clean pursuit runtime state without touching git working tree | |
| `--hard` | Run soft cleanup, then offer explicit git rollback choices | |

## Input Handling

1. Parse `$ARGUMENTS` and pick mode:
   - No arguments -> `--report`
   - `--report` -> report mode
   - `--soft` -> soft recovery mode
   - `--hard` -> hard recovery mode
2. If multiple mode flags are provided, reject and show valid usage.
3. If unknown flags are provided, show mode table and usage examples.

## Data Sources

- Pursuit state: `.relentless/current-pursuit.json`
- Agent ownership map: `.relentless/agent-assignments.json`
- Shared context directory: `.relentless/shared-context/`
- Compaction snapshot: `.relentless/last-compaction.json`
- Halt flag: `.relentless/halt`
- Lessons store (preserve): `.relentless/lessons.jsonl`
- Pursuit archive (preserve): `.relentless/history/`
- Shared context logs for diagnosis:
  - `.relentless/shared-context/error-log.jsonl`
  - `.relentless/shared-context/decisions.jsonl`

## Report Mode (default)

1. Check whether `.relentless/current-pursuit.json` exists.
2. If it does not exist, report:
   `No active or failed pursuit found.`
3. If state exists, read and display:
   - Task (`task`)
   - Progress summary (completed/pending/cancelled todo counts)
   - Todo-level failures or blocked items
   - Circuit breaker state and recent trigger info
4. Read `.relentless/shared-context/error-log.jsonl` when present and show recent errors (newest first).
5. Read `.relentless/agent-assignments.json` when present and show stale assignments (agents mapped to completed/cancelled or missing todos).
6. End with a recommendation:
   - Recommend `--soft` when state is stale/corrupted but no rollback need is detected.
   - Recommend `--hard` when the pursuit appears to have introduced risky or unclear workspace changes.

## Soft Mode (`--soft`)

1. Extract lessons from `.relentless/shared-context/error-log.jsonl` before cleanup (same pattern as `extractLessons` behavior).
2. If pursuit state exists and shows useful progress, archive it into `.relentless/history/` before deletion.
3. Remove `.relentless/current-pursuit.json`.
4. Remove `.relentless/agent-assignments.json`.
5. Clear `.relentless/shared-context/` fully.
6. Remove `.relentless/last-compaction.json`.
7. Clear `.relentless/halt` if present.
8. Print a completion report with:
   - Cleared items
   - Preserved items (`.relentless/lessons.jsonl`, `.relentless/history/`)
   - Suggested next command (`/status` or `/unleash`)

Important safety rule: never delete `.relentless/lessons.jsonl` or `.relentless/history/`.

## Hard Mode (`--hard`)

1. Execute all soft mode steps first.
2. Find the pre-pursuit commit candidate:
   - Run `git log --oneline -20`
   - Estimate pursuit start from `updated_at` or earliest todo timestamp in pursuit state/archive
   - Identify the latest commit before that start time
3. Show the chosen commit candidate and list files changed since then.
4. Ask for explicit confirmation before any git rollback action.
5. Offer rollback options:
   - `git stash` - save current changes for later recovery
   - `git reset --soft <commit>` - move HEAD while keeping changes in working tree/index
   - `git reset --hard <commit>` - destructive full rollback to selected commit
6. Execute only the option the user confirms.
7. After execution, summarize repository state and remind user where preserved lessons/history live.

Critical safety rule: always require explicit confirmation before destructive git operations, especially `git reset --hard`.

## Error Handling

| Condition | Behavior |
|-----------|----------|
| No pursuit state exists | Report empty state and stop unless user requested explicit cleanup; cleanup still clears stale files if present |
| Corrupted `current-pursuit.json` | Warn user, back up as `.corrupted`, continue with safe cleanup, and recommend `--soft` |
| Git command fails in hard mode | Stop git flow, show error output, keep preserved artifacts, and provide manual recovery commands |
| Lessons extraction fails | Warn but continue cleanup; never block recovery on lessons extraction failure |

## Output Style

- Keep tone reassuring and direct; recovery moments are high-stress.
- Use clear step-by-step progress messages.
- Separate `Diagnosis`, `Actions Taken`, and `What Was Preserved` sections.
- Always surface irreversible actions with explicit warning labels.
- End with the safest next step for the user.
