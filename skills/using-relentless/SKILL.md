---
name: using-relentless
source: Forked from superpowers by Jesse Vincent (MIT License)
description: Lightweight bootstrap for Relentless-enabled sessions
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill entirely.
</SUBAGENT-STOP>

## Relentless Quick Reference

**Orchestration commands:** `/unleash`, `/recon`, `/pursuit`, `/halt`, `/status`, `/resume`, `/history`, `/metrics`, `/recover`, `/health`, `/branch`, `/branches`, `/switch`, `/merge`, `/abandon`

**When to use orchestration:** Multi-file features, architectural changes, tasks needing multiple agents.
**When NOT to:** Simple edits, single-file fixes, questions, quick tasks. Just do the work directly.

## Rules

1. If dispatched by Conductor → follow handoff constraints exactly.
2. If `.relentless/halt` exists → stop and report state.
3. Don't expand scope beyond assigned tasks/files.

## Skills (load on-demand via `skill` tool, only when relevant)

`intent-gate` · `todo-enforcer` · `pursuit` · `unleash` · `recon` · `ui-craft` · `history` · `preflight` · `metrics` · `recovery` · `health` · `branching` · `brainstorming` · `writing-plans` · `test-driven-development` · `systematic-debugging` · `verification-before-completion` · `requesting-code-review` · `receiving-code-review` · `finishing-a-development-branch` · `using-git-worktrees` · `writing-skills`

Skills location: `/home/mizu/.config/opencode/skills/relentless/`
