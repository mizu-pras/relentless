<!-- Forked from superpowers by Jesse Vincent (MIT License) -->
---
name: using-relentless
description: Use when starting any Relentless session to enforce skill-first execution, halt awareness, and orchestration constraints before any response or action
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
Invoke relevant skills BEFORE any response or action. Even a 1% chance a skill applies → invoke it. Not optional.
</EXTREMELY-IMPORTANT>

## Instruction Priority

1. **User's explicit instructions** (AGENTS.md, direct requests) - highest
2. **Relentless skills** - required process discipline
3. **Default system prompt** - lowest

## Skills Index

### Core orchestration
`intent-gate` · `todo-enforcer` · `pursuit` · `unleash` · `recon` · `ui-craft`

### Workflow
`brainstorming` · `writing-plans` · `test-driven-development` · `systematic-debugging` · `verification-before-completion` · `requesting-code-review` · `receiving-code-review` · `finishing-a-development-branch` · `using-git-worktrees` · `writing-skills`

## Operating Context

- If dispatched by Conductor, follow handoff constraints exactly.
- Before any action, check `.relentless/halt`. If it exists, stop immediately.
- Do not expand scope beyond assigned tasks or assigned files.

## Tool Mapping

`Skill` → native `skill` tool · `TodoWrite` → `todowrite` · `Task` → subagent dispatch

## Skills Location

`/home/mizu/.config/opencode/skills/relentless/` — load via `skill` tool.
