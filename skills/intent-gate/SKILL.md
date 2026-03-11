---
name: intent-gate
description: Use before any action to analyze user intent, classify task type, and detect ambiguity. Prevents literal misinterpretation and scope errors.
---

# IntentGate

Analyze intent before acting. One wrong interpretation wastes more time than asking.

## Classification

Classify every incoming task into one of:

| Type | Description | Proceed? |
|------|-------------|----------|
| `create` | Build something new | Yes if scope is clear |
| `modify` | Change existing code | Yes if target is clear |
| `delete` | Remove code/files | **Confirm if scope is broad** |
| `debug` | Fix a bug or error | Yes |
| `explore` | Understand codebase | Yes |
| `refactor` | Restructure without changing behavior | Yes if target is clear |
| `visual` | UI/UX improvement | Yes, route to Maestro |
| `trivial` | Single file, < 20 lines | Yes, skip full orchestration |

## Ambiguity Detection

Before proceeding, check for these patterns:

**Scope ambiguity — always clarify:**
- "all", "everywhere", "all files" without a specific directory or pattern
- "fix the tests" without specifying which tests
- "clean up the code" without specifying what clean means

**Destructive ambiguity — always confirm:**
- "delete", "remove", "clean", "wipe" without explicit target
- Any action that cannot be undone by a git checkout

**Target ambiguity — clarify if multiple candidates:**
- "update the user model" when multiple files match
- "fix the auth" when auth spans many files

## Decision Protocol

```
1. Classify the intent type
2. Check for ambiguity patterns
3. If trivial → handle directly, skip unleash orchestration
4. If ambiguous → ask ONE clarifying question, then proceed
5. If clear → proceed immediately, do not ask unnecessary questions
```

**Key rule:** If it is clear enough that a reasonable developer would proceed without asking, proceed. Do not over-ask.

## Trivial Task Detection

A task is trivial if ALL of these are true:
- Affects at most 1-2 files
- Estimated change is < 20 lines
- No new dependencies or architecture changes
- No tests need to be written

Trivial tasks skip the full unleash orchestration and are handled by the current agent directly.
