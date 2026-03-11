---
description: "Stop all active Relentless orchestration. Use '/halt clear' to remove the halt flag before resuming."
---

Arguments: $ARGUMENTS

If arguments contain "clear":
  1. Delete `.relentless/halt` file if it exists
  2. Say: "Halt flag cleared. Run /resume to continue the interrupted pursuit."

Otherwise (standard /halt):
  1. Write `.relentless/halt` with current timestamp
  2. Instruct all active agents: "HALT detected. Stop immediately. Save your current state and report what you completed."
  3. Read `.relentless/current-pursuit.json` and summarize what was completed and what remains
  4. Say: "Orchestration halted. State saved. Run /resume when ready to continue (run /halt clear first)."
