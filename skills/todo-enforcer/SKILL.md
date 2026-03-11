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
