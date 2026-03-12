---
name: history
description: "Browse and analyze archived pursuit history from .relentless/history/"
---

# History - Pursuit Archive Browser

View past pursuits, their outcomes, and aggregate statistics.

## Modes

| Flag | Behavior | Default |
|------|----------|---------|
| `--list` | Show summary of all archived pursuits | yes (default) |
| `--detail <id>` | Show full details of a specific pursuit | |
| `--stats` | Show aggregate statistics | |

## Input Handling

1. Parse `$ARGUMENTS` and pick mode:
   - No arguments -> `--list`
   - `--list` -> list mode
   - `--detail <id>` -> detail mode
   - `--stats` -> stats mode
2. If flags are invalid or incomplete, explain valid usage and show mode table.

## Data Sources

- Archive directory: `.relentless/history/`
- Archive format: one JSON file per pursuit, named `{timestamp}-{task-name}.json`
- Archive payload: pursuit state plus `archived_at` timestamp
- Optional lessons source: `.relentless/lessons.jsonl`

## List Mode (default)

1. Ensure `.relentless/history/` exists.
2. If missing, create it and show the empty-state message.
3. Read all `.json` files in `.relentless/history/`.
4. For each valid archive, extract:
   - Task name (`task`)
   - Date (`archived_at`)
   - Completion (`completed todos` / `total todos`)
   - Agents used (unique `agent` values from todos)
5. Sort rows by date descending (newest first).
6. Render a table:

```markdown
## Pursuit History

| # | Date | Task | Completion | Agents |
|---|------|------|------------|--------|
| 1 | 2026-03-12 14:30 | Build REST API | 8/8 (100%) | artisan, sentinel |
| 2 | 2026-03-11 09:15 | Fix auth bug | 3/5 (60%) | artisan |
```

If no archives exist, say:
`No archived pursuits found. Complete a pursuit with /unleash to see history here.`

## Detail Mode

1. Resolve `<id>` against archive filenames.
   - Allow partial filename matches.
   - Match case-insensitively.
2. If no match, say:
   `No pursuit found matching '<id>'. Run /history to see all pursuits.`
3. If multiple matches, list candidates and ask for a more specific id.
4. If exactly one match, display:
   - Task name (and any available description context)
   - Archived date (`archived_at`)
   - Todo list with status (`completed`, `pending`, `cancelled`)
   - Agent assignment for each todo
   - Circuit breaker state captured in archive
5. If `.relentless/lessons.jsonl` exists, include lessons near matching timestamps.
   - If no matching lessons, omit the section.

## Stats Mode

1. Read all valid archives from `.relentless/history/`.
2. If fewer than 2 archives, say:
   `Not enough data for meaningful statistics. Complete more pursuits first.`
3. Compute and display:
   - Total pursuits archived
   - Completion rate (`all-todos-complete pursuits / total pursuits`)
   - Average todos per pursuit
   - Most-used agents (count todo assignments per agent)
   - Common task patterns (word frequency from task names)
4. Prefer concise numeric output plus top-N lists for agents/patterns.

## Error Handling

| Condition | Behavior |
|-----------|----------|
| `.relentless/history/` missing | Create directory, then show empty-state message |
| Corrupted archive JSON | Skip file and warn: `Skipping corrupted archive: <filename>` |
| `--detail` has no `<id>` | Show usage hint for `--detail <id>` |
| `--detail` matches multiple archives | Show candidates, request more specific id |

## Output Style

- Keep output scannable and compact.
- Use tables for list mode and structured sections for detail/stats.
- Show dates in local `YYYY-MM-DD HH:mm` style when possible.
- Never fail the whole command because one archive is malformed.
