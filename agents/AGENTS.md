# Agents Directory

## Purpose
- Defines specialized agents, model mappings, and role boundaries.

## Agent Roster
- `conductor`: orchestrator for planning, dispatch, and validation
- `artisan`: deep implementation and refactoring
- `maestro`: UI/UX and visual interaction work
- `sentinel`: debugging, review, and quality assurance
- `scout`: fast read-only reconnaissance

## Model Assignment
- Agent model selection is declared in each agent markdown frontmatter.
- Treat those files as the source of truth for role + model mapping.

## Authority Pattern
- Expected hierarchy: conductor > sentinel > artisan/maestro > scout

## Handoff Conventions
- Include task intent, constraints, and expected output format.
- For scoped work, specify `assigned_files` and hard boundaries.
- Keep role separation strict (e.g., scout read-only, maestro visual-first).
