# Relentless Skills

## Directory

### Core Orchestration Skills
- **intent-gate/** — Intent classification and ambiguity detection. Injected into system prompt.
- **todo-enforcer/** — Task focus enforcement and scope control. Injected into system prompt.
- **pursuit/** — Relentless completion loop. On-demand via `/pursuit`.
- **unleash/** — Full autonomous orchestration pipeline. On-demand via `/unleash`.
- **recon/** — Codebase mapping and AGENTS.md generation. On-demand via `/recon`.
- **ui-craft/** — 5-phase UI/UX design process. Auto-loaded by Maestro.
- **using-relentless/** — Bootstrap skill. Injected into every session.

### Workflow Skills (forked from superpowers, MIT License)
- **brainstorming/** — Collaborative design exploration before implementation.
- **writing-plans/** — Structured implementation plan creation.
- **test-driven-development/** — RED-GREEN-REFACTOR cycle enforcement.
- **systematic-debugging/** — 4-phase root cause investigation.
- **verification-before-completion/** — Evidence-based completion verification.
- **requesting-code-review/** — Code review dispatch (routes to Sentinel).
- **receiving-code-review/** — Handling code review feedback with rigor.
- **finishing-a-development-branch/** — Branch completion options and cleanup.
- **using-git-worktrees/** — Isolated workspace creation for feature work.
- **writing-skills/** — Meta-skill for creating new relentless skills.

## Runtime Behavior
- `intent-gate` and `todo-enforcer` are injected into every system prompt via the plugin.
- `using-relentless` is injected as bootstrap skill.
- Other skills are loaded on-demand via the Skill tool.
- Agents auto-load specific skills: Maestro loads `ui-craft`, Sentinel loads `systematic-debugging`.

## Attribution
Workflow skills are forked from [superpowers](https://github.com/obra/superpowers) by Jesse Vincent, licensed under MIT.
