---
description: "Recover from failed or stuck pursuits. Use '--soft' for state cleanup, '--hard' for git rollback, '--report' for diagnosis."
---

Arguments: $ARGUMENTS

Load the `relentless:recovery` skill and follow its instructions.

Pass arguments to the skill:
- No arguments or `--report`: show what happened in the failed pursuit
- `--soft`: clean up pursuit state without touching code
- `--hard`: clean up state AND offer git-based rollback
