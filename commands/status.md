---
description: "Show current Relentless orchestration state: active pursuit, agent assignments, circuit breaker status."
---

Use the `relentless_status` tool to show current orchestration state.

If the tool is unavailable, read `.relentless/current-pursuit.json` directly and display:
- Active pursuit task and progress (X/Y todos complete)
- Current loop number and max loops
- Agent assignments (which agent is on which todo)
- Circuit breaker state (failures, injections)
- Halt flag status
- Last snapshot timestamp

If `.relentless/current-pursuit.json` does not exist, say: "No active pursuit. Run /unleash to start one."
