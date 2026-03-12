---
name: chunk-gate
description: Use when completing an implementation chunk, moving between plan chunks, or advancing a pursuit loop batch where intermediate typecheck, build, and test validation must pass before continuing.
---

# Chunk Gate

## Overview

Chunk-gate prevents the "build all first, fix all later" anti-pattern.
DevMetrics found that 54% of session time was wasted on post-hoc fixes that intermediate build checks would have caught earlier.

The rule is simple: each implementation chunk must prove it is stable before the next chunk starts.

## When to Use

Use this skill when:
- A plan is split into `## Chunk N: <name>` sections.
- A chunk's implementation tasks were just completed.
- A pursuit loop finishes a todo batch that maps to one chunk.
- The next chunk is about to begin.

Do not wait for "final verification" to discover broken typecheck, build, or tests.
That delay compounds errors and creates long fix cascades.

## Gate Protocol

After each chunk completion, run the gate before proceeding.

### Required Commands (default)

1. `tsc --noEmit` (if TypeScript project)
2. `npm run build` (or project build command)
3. `npm test` (or project test command)

All required gate commands must pass.

If any command fails:
- Stop chunk progression immediately.
- Fix failures now.
- Re-run the full gate.
- Proceed only after all required commands pass.

Never defer gate failures to a later "cleanup" chunk.

## Execution Sequence

For every gate run:

1. Check `.relentless/halt` before running commands.
2. Run gate commands in configured order.
3. Record pass/fail for each command.
4. If any fail, create explicit fix todos and continue the pursuit loop on those fixes.
5. Re-run gate after fixes.
6. Advance to next chunk only when gate is fully green.

## Integration with Plans

Plans should define chunk acceptance in explicit gate terms.

Use this completion language in plans:

`This chunk is done when [gate commands] pass.`

Recommended chunk template:

```markdown
## Chunk N: <name>

### Tasks
- [ ] Task A
- [ ] Task B

### Acceptance Gate
- [ ] tsc --noEmit
- [ ] npm run build
- [ ] npm test
```

If a chunk has no acceptance gate, add one before execution.

## Integration with Pursuit

Inside the pursuit completion loop:

- Map todos to the current chunk.
- When chunk todos are complete, run chunk-gate.
- If gate fails, create fix todos immediately.
- Mark fix todos `in_progress`/`completed` through normal pursuit tracking.
- Re-run chunk-gate after fixes.
- Move to next chunk only after gate success.

Chunk-gate is an intermediate control point.
It complements, but does not replace, final `verification-before-completion` checks.

## Configurable Commands

Default configuration:

```yaml
gate_commands:
  - "tsc --noEmit"     # typecheck
  - "npm run build"    # build
  - "npm test"         # test
```

Projects can override via `.opencode/relentless.jsonc` under `chunk_gate`:

```jsonc
{
  "chunk_gate": {
    "gate_commands": [
      "npm run lint",
      "npm run build",
      "npm test -- --runInBand"
    ]
  }
}
```

Guidance for overrides:
- Keep commands deterministic and non-interactive.
- Keep command order intentional (fastest signal first is acceptable).
- Include at least type/build validation and test coverage for the chunk.
- If tests are not available yet, run at minimum typecheck and build.

## Rationalization Prevention

| Excuse | Reality |
|--------|---------|
| "I'll check at the end" | Compounds errors and repeats the same 54% waste pattern. |
| "This chunk is trivial" | Trivial changes can still break typecheck, build, or tests. |
| "Build is slow" | Slow builds are still faster than debugging 7 fix iterations later. |
| "Tests haven't been written yet" | Run at least typecheck and build, then add tests as soon as possible. |

When these thoughts appear, treat them as gate-violation risk.

## Red Flags

Stop and run the gate if any signal appears:

- "I'll batch verification after the next chunk."
- "I already know this change is safe."
- "Just one more todo before I run build/test."
- "I'll let Conductor discover failures in review."
- "The branch is messy anyway; I'll stabilize later."
- "I only changed docs/config so verification is unnecessary."

Any red flag means verification is overdue.

## Reporting to Conductor

After each chunk gate, report status with command-level results.

Use a concise format:

```text
CHUNK GATE REPORT:
Chunk: <name>
Typecheck: pass|fail
Build: pass|fail
Test: pass|fail
Outcome: proceed|fix-required
Fix todos created: <count>
```

On failure:
- Include the failing command(s).
- Include the first actionable error signal.
- Include fix todo IDs created.
- State that next chunk is blocked until gate passes.

## Operational Rules

- Never mark a chunk complete before gate success.
- Never start next chunk while current chunk gate is failing.
- Never hide gate failure inside unrelated todos.
- Always check `.relentless/halt` before gate execution.
- Always preserve strict chunk boundaries in progress reporting.

## Relationship to Final Verification

Chunk-gate catches breakage early between chunks.
`verification-before-completion` confirms final branch-level readiness.

Both are required:
- Chunk-gate for intermediate stability.
- Final verification for completion integrity.

Skipping chunk-gate reintroduces the failure pattern that caused 54% wasted time.
