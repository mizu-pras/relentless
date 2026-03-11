<!-- Forked from superpowers by Jesse Vincent (MIT License) -->
---
name: using-relentless
description: Use when starting any Relentless session to enforce skill-first execution, halt awareness, and orchestration constraints before any response or action
---

<SUBAGENT-STOP>
If you were dispatched as a subagent to execute a specific task, skip this skill.
</SUBAGENT-STOP>

<EXTREMELY-IMPORTANT>
If you think there is even a 1% chance a skill might apply to what you are doing, you ABSOLUTELY MUST invoke the skill.

IF A SKILL APPLIES TO YOUR TASK, YOU DO NOT HAVE A CHOICE. YOU MUST USE IT.

This is not negotiable. This is not optional. You cannot rationalize your way out of this.
</EXTREMELY-IMPORTANT>

## Instruction Priority

Relentless skills override default system behavior, but **user instructions always take precedence**:

1. **User's explicit instructions** (AGENTS.md, direct requests, task handoff constraints) - highest priority
2. **Relentless skills** - required process and execution discipline
3. **Default system prompt** - lowest priority

If user instructions conflict with a skill, follow user instructions.

## Relentless Skills Index

Use this list to decide what to invoke.

### Bootstrap

- `using-relentless`

### Core orchestration

- `intent-gate`
- `todo-enforcer`
- `pursuit`
- `unleash`
- `recon`
- `ui-craft`

### Forked workflow

- `brainstorming`
- `writing-plans`
- `test-driven-development`
- `systematic-debugging`
- `verification-before-completion`
- `requesting-code-review`
- `receiving-code-review`
- `finishing-a-development-branch`
- `using-git-worktrees`
- `writing-skills`

## Relentless Operating Context

- Skills are used by specialized agents: **Conductor**, **Artisan**, **Sentinel**, **Maestro**, and **Scout**.
- Conductor is the orchestrator. If you are dispatched by Conductor, follow handoff constraints exactly.
- Before any action, check `.relentless/halt`. If it exists, stop immediately and report status.
- Do not expand scope beyond assigned tasks or assigned files.

## Tool Mapping (OpenCode)

- `Skill` tool -> native `skill` tool
- `TodoWrite` -> `todowrite`
- `Task` tool -> subagent dispatch

# Using Skills

## The Rule

**Invoke relevant or requested skills BEFORE any response or action.** Even a 1% chance a skill might apply means that you should invoke the skill to check. If an invoked skill turns out to be wrong for the situation, you do not need to use it.

```dot
digraph skill_flow {
    "User message received" [shape=doublecircle];
    "About to EnterPlanMode?" [shape=doublecircle];
    "Already brainstormed?" [shape=diamond];
    "Invoke brainstorming skill" [shape=box];
    "Might any skill apply?" [shape=diamond];
    "Invoke Skill tool" [shape=box];
    "Announce: 'Using [skill] to [purpose]'" [shape=box];
    "Has checklist?" [shape=diamond];
    "Create TodoWrite todo per item" [shape=box];
    "Follow skill exactly" [shape=box];
    "Respond (including clarifications)" [shape=doublecircle];

    "About to EnterPlanMode?" -> "Already brainstormed?";
    "Already brainstormed?" -> "Invoke brainstorming skill" [label="no"];
    "Already brainstormed?" -> "Might any skill apply?" [label="yes"];
    "Invoke brainstorming skill" -> "Might any skill apply?";

    "User message received" -> "Might any skill apply?";
    "Might any skill apply?" -> "Invoke Skill tool" [label="yes, even 1%"];
    "Might any skill apply?" -> "Respond (including clarifications)" [label="definitely not"];
    "Invoke Skill tool" -> "Announce: 'Using [skill] to [purpose]'";
    "Announce: 'Using [skill] to [purpose]'" -> "Has checklist?";
    "Has checklist?" -> "Create TodoWrite todo per item" [label="yes"];
    "Has checklist?" -> "Follow skill exactly" [label="no"];
    "Create TodoWrite todo per item" -> "Follow skill exactly";
}
```

## Red Flags

These thoughts mean STOP - you are rationalizing:

| Thought | Reality |
|---------|---------|
| "This is just a simple question" | Questions are tasks. Check for skills. |
| "I need more context first" | Skill check comes BEFORE clarifying questions. |
| "Let me explore the codebase first" | Skills tell you HOW to explore. Check first. |
| "I can check git/files quickly" | Files lack conversation context. Check for skills. |
| "Let me gather information first" | Skills tell you HOW to gather information. |
| "This doesn't need a formal skill" | If a skill exists, use it. |
| "I remember this skill" | Skills evolve. Read current version. |
| "This doesn't count as a task" | Action = task. Check for skills. |
| "The skill is overkill" | Simple things become complex. Use it. |
| "I'll just do this one thing first" | Check BEFORE doing anything. |
| "This feels productive" | Undisciplined action wastes time. Skills prevent this. |
| "I know what that means" | Knowing the concept != using the skill. Invoke it. |

## Skill Priority

When multiple skills could apply, use this order:

1. **Process skills first** (`brainstorming`, `systematic-debugging`) - these determine HOW to approach the task
2. **Implementation skills second** (domain or workflow skills) - these guide execution

"Let's build X" -> `brainstorming` first, then implementation skills.
"Fix this bug" -> `systematic-debugging` first, then domain-specific skills.

## Skill Types

**Rigid** (`test-driven-development`, `systematic-debugging`): Follow exactly. Do not adapt away discipline.

**Flexible** (patterns and references): Adapt principles to the task context.

The skill itself defines whether it is rigid or flexible.

## User Instructions

Instructions say WHAT, not HOW. "Add X" or "Fix Y" does not mean skip workflows.

## Skills Location

Relentless skills are stored under:

- `/home/mizu/.config/opencode/skills/relentless/`

Load skills through the native `skill` tool.
