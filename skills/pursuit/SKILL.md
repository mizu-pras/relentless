---
name: pursuit
description: Use to drive a task to 100% completion through a structured loop. Repeats until all completion criteria are met or a stopping condition is reached.
---

# Pursuit — Relentless Completion Loop

Do not stop until done. Do not declare victory until all criteria pass.

## Completion Criteria

ALL of the following must be true before a pursuit is complete:

1. All todo items are `completed` (no `pending` or `in_progress` remaining)
2. All tests pass — run the test suite and verify exit code 0
3. Build succeeds — if a build step exists, verify exit code 0
4. Sentinel review: no Critical findings outstanding

If any criterion fails, the loop continues.

## Loop Protocol

```
Loop N (of max 10):
  1. Check .relentless/halt → if set: STOP, report state
  2. Proactive budget forecast:
     a. Read token_usage and context_limit from .relentless/current-pursuit.json (circuit_breaker field)
     b. Estimate cost of upcoming dispatches:
        - Per agent: ~300 (handoff) + ~500/file × files + ~200/call × 5 calls + ~800 (skill) + ~2000 (response)
        - Total = sum of all agents to dispatch
     c. If (token_usage + estimated_cost) / context_limit > 0.75: compact BEFORE dispatching
     d. If > 0.85: STOP — too close to limit, report to user
  3. Identify all incomplete todos
  4. If none → check completion criteria:
     a. Run tests → if fail: create bug-fix todos
     b. Run build → if fail: create fix todos
     c. Dispatch Sentinel review → if Critical findings: create fix todos
     d. If all pass → COMPLETE, report success
  5. Assign todos to appropriate agents by category
  6. Dispatch agents (respect file ownership)
  7. Wait for results
  8. Mark completed todos
  9. Check progress:
     - If at least 1 todo was completed: continue to next loop
     - If 0 todos completed (stall): check stall_limit
       → 2 consecutive stalls: STOP, report to user
  10. Continue to Loop N+1
```

## Stall Detection

**Primary stall mechanism (this skill):**
A stall occurs when 0 todos were completed in a loop. After `stall_limit` (default: 2) consecutive stalls, stop and report.

**Circuit breaker stall (independent):**
3+ consecutive errors without output triggers the circuit breaker (Layer 5). This fires independently — either stall condition can stop the pursuit.

When both fire simultaneously, this skill's message takes precedence (it has more task context).

## Stopping Conditions

| Condition | Action |
|-----------|--------|
| All criteria met | COMPLETE — celebrate and report |
| Max iterations reached | STOP — report progress and what remains |
| 2 consecutive stalls | STOP — report what's blocking |
| `.relentless/halt` set | STOP — save state for /resume |
| Circuit breaker tripped | STOP — report error details |

## Reporting on Stop

Always report:
- How many todos were completed
- Which todos remain and why
- What the user should do next

Never silently stop.
