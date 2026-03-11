# Skills Directory

## Purpose
- Houses behavioral skills injected into or loaded by agents.

## Core Skills
- `intent-gate/`: intent classification and ambiguity checks
- `todo-enforcer/`: strict task-focus and scope control
- `pursuit/`: loop to drive tasks to completion
- `unleash/`: full orchestration flow for autonomous execution
- `recon/`: codebase mapping and AGENTS.md workflows
- `ui-craft/`: 5-phase UI/UX process for visual work

## References
- `recon/references/`:
  - `quality-criteria.md`
  - `templates.md`
- `ui-craft/references/` includes design guidance and anti-patterns.

## Runtime Behavior
- `intent-gate` and `todo-enforcer` are injected broadly at runtime.
- Other skills are loaded on demand through the skill loader.

## Editing Guidance
- Keep skills executable and concrete, not generic.
- Put reusable rubrics and templates in `references/`.
- Update references alongside behavior changes.
