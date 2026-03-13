# Commands Directory

## Purpose
- Contains slash-command wrappers that trigger plugin behaviors.

## Available Commands
- `/unleash`: full autonomous orchestration pipeline
- `/pursuit`: completion loop toward done criteria
- `/recon`: codebase scan and AGENTS.md workflows
- `/resume`: continue interrupted pursuit state
- `/status`: inspect current orchestration state
- `/halt`: stop active orchestration and set halt flag
- `/history`: browse archived pursuit history (supports `--list`, `--detail <id>`, `--stats`)
- `/metrics`: display pursuit analytics and performance metrics (supports `--detailed`, `--json`)
- `/recover`: recover from failed or stuck pursuits (supports `--report`, `--soft`, `--hard`)
- `/health`: run diagnostic health checks on installation (supports `--fix`)
- `/branch`: create a new pursuit branch for exploring alternative approaches (experimental)
- `/branches`: list all active pursuit branches with status
- `/switch`: switch to a different pursuit branch
- `/merge`: merge a successful pursuit branch back into main pursuit
- `/abandon`: abandon a pursuit branch and clean up resources

## Behavioral Notes
- Command files are thin wrappers; heavy logic lives in plugin runtime/skills.
- Keep command docs aligned with actual runtime behavior and flags.

## Recon Flags
- `--audit`: evaluate AGENTS.md quality
- `--improve`: propose targeted AGENTS.md improvements
- `--update`: refresh AGENTS.md after project changes
- `--dirty`: update only AGENTS.md files marked dirty by doc-tracker
- `--max-depth=N`: cap scan depth for discovery
