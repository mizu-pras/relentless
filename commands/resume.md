---
description: "Resume an interrupted /pursuit or /unleash session from saved state in .relentless/"
---

Use the `relentless_resume` tool to resume from the last saved pursuit state.

Steps:
1. Check for `.relentless/halt` — if set, stop and say: "Halt flag is active. Run /halt clear before resuming."
2. Read `.relentless/current-pursuit.json` — if missing, say: "No interrupted pursuit found."
3. Present the saved state summary and ask: "Resume from this state? (yes/no)"
4. If yes: continue the pursuit from the last known step.
