---
name: health
description: "Diagnostic health checks for Relentless installation. Verifies symlinks, skills, state, dependencies, and build."
---

# Health - Relentless Installation Diagnostics

Run a full health scan of the Relentless setup and optionally repair safe-to-fix issues.

## Modes

| Flag | Behavior | Default |
|------|----------|---------|
| none | Run all checks and report findings only | yes (default) |
| `--fix` | Run all checks, then auto-repair safe issues and report changes | |

## Input Handling

1. Parse `$ARGUMENTS`:
   - No arguments -> check-only mode
   - `--fix` -> check-and-fix mode
2. Reject unknown flags and show valid usage.
3. If multiple flags are provided and include unsupported combinations, show usage and exit safely.

## Check Categories

Run checks in this order and record each result with status and remediation.

### A) Symlinks Check

Verify each target exists and points to the correct project path:

- Plugin symlink: `~/.config/opencode/plugins/relentless.js` -> `.opencode/dist/relentless.js`
- Agent symlinks:
  - `~/.config/opencode/agents/conductor.md`
  - `~/.config/opencode/agents/artisan.md`
  - `~/.config/opencode/agents/maestro.md`
  - `~/.config/opencode/agents/sentinel.md`
  - `~/.config/opencode/agents/scout.md`
- Command symlinks:
  - `~/.config/opencode/commands/unleash.md`
  - `~/.config/opencode/commands/pursuit.md`
  - `~/.config/opencode/commands/recon.md`
  - `~/.config/opencode/commands/resume.md`
  - `~/.config/opencode/commands/status.md`
  - `~/.config/opencode/commands/halt.md`
  - `~/.config/opencode/commands/history.md`
  - `~/.config/opencode/commands/metrics.md`
  - `~/.config/opencode/commands/recover.md`
  - `~/.config/opencode/commands/health.md`
- Skills symlink directory: `~/.config/opencode/skills/relentless/` -> project `skills/`

Status rules:
- `✓` valid symlink and target exists
- `✗` missing or broken symlink

Fix behavior (`--fix` only):
- Re-run the equivalent `ln -sf` command from `install.sh` for each failed item.
- Report each repaired symlink explicitly.

### B) Skills Integrity Check

For each subdirectory in `skills/`:

1. Verify `SKILL.md` exists.
2. Verify file is readable.
3. Validate YAML frontmatter includes both `name` and `description`.

Status rules:
- `✓` valid file with required frontmatter fields
- `⚠` file exists but frontmatter is missing/incomplete
- `✗` missing or unreadable `SKILL.md`

Fix behavior (`--fix`):
- Do not auto-generate missing skill content.
- Report exact directories requiring manual repair.

### C) State Integrity Check

Check runtime state artifacts if they exist:

- `.relentless/current-pursuit.json` -> must parse as JSON
- `.relentless/agent-assignments.json` -> must parse as JSON
- JSONL files (line-by-line parse):
  - `.relentless/shared-context/error-log.jsonl`
  - `.relentless/shared-context/decisions.jsonl`
  - `.relentless/lessons.jsonl`

Status rules:
- `✓` valid content, or file absent where absence is acceptable
- `✗` corrupted JSON/JSONL content

Fix behavior (`--fix`):
- Corrupted JSONL: write filtered version with only parseable lines; store rejected lines in a `.corrupted` sidecar.
- Corrupted JSON: rename file to `<name>.corrupted` and continue.

### D) Dependencies Check

Validate required dependencies are present:

- `.opencode/node_modules/@opencode-ai/plugin` exists
- Root `node_modules/` contains expected dev dependencies (`typescript`, `eslint`)

Status rules:
- `✓` dependencies present
- `✗` missing dependency directories/packages

Fix behavior (`--fix`):
- Do not auto-install silently.
- Recommend exact install commands (for example `npm install`).

### E) Build Check

Validate build outputs and freshness:

- `lib/dist/` exists and contains compiled `.js` files
- `.opencode/dist/` exists and contains compiled plugin artifacts
- Compare source mtimes against compiled mtimes to detect stale outputs

Status rules:
- `✓` present and up to date
- `⚠` present but stale
- `✗` missing output directories/files

Fix behavior (`--fix`):
- Run `npm run build` for main build artifacts.
- Run `npx tsc -p .opencode/tsconfig.json` when plugin build output is missing or stale.
- Report commands run and whether each succeeded.

### F) Config Check

Validate config files:

- Required: `defaults.jsonc` must exist and parse as JSONC
- Optional: `~/.config/opencode/relentless.jsonc` if present, must parse
- Optional: `.opencode/relentless.jsonc` if present, must parse

Status rules:
- `✓` valid config
- `✗` missing required defaults or parse failure

Fix behavior (`--fix`):
- Do not overwrite config files automatically.
- Report parse errors and point to file locations for manual correction.

## Output Format

Render results in this checklist-oriented structure:

```markdown
## Relentless Health Check

### Symlinks
✓ Plugin: ~/.config/opencode/plugins/relentless.js
✓ Agent: conductor.md
✗ Agent: maestro.md (broken symlink)
✓ Commands: all 7 verified
✓ Skills: ~/.config/opencode/skills/relentless/

### Skills Integrity
✓ 18/18 skills have valid SKILL.md with frontmatter

### State
✓ No active pursuit (clean state)

### Dependencies
✓ @opencode-ai/plugin v1.2.24
✓ Dev dependencies installed

### Build
✓ lib/dist/ up to date (8 modules)
⚠ .opencode/dist/ may be stale (source newer than compiled)

### Config
✓ defaults.jsonc valid
✓ User config valid

---
Result: 1 warning, 1 error found
Run `/health --fix` to attempt auto-repair.
```

## Fix Mode (`--fix`) Behavior

1. Run the full check pass first.
2. Apply only safe, reversible, or clearly scoped repairs:
   - Recreate broken symlinks.
   - Filter bad JSONL lines with backup sidecar.
   - Rename corrupted JSON files to `.corrupted`.
   - Rebuild stale/missing artifacts with explicit build commands.
3. Do not auto-edit configs or invent missing skill content.
4. End with `Fixes Applied` and `Manual Actions Needed` sections.

## Error Handling

| Condition | Behavior |
|-----------|----------|
| Home config paths inaccessible | Mark affected checks as `✗`, continue remaining checks, suggest permission fix |
| Symlink target cannot be resolved | Mark `✗`; in `--fix`, retry `ln -sf` and report failure output if still broken |
| JSON/JSONL parse exceptions | Mark file `✗`, continue scanning, include parse location details when available |
| Build commands fail in `--fix` | Mark build `✗`, include command output and next manual command |
| Missing `defaults.jsonc` | Mark config `✗` and treat as critical installation error |

## Output Style

- Use scannable checklist sections with status indicators: `✓`, `⚠`, `✗`.
- Keep each line short and action-oriented.
- Always include totals for warnings/errors at the end.
- In `--fix`, clearly separate what was checked, what was fixed, and what still needs manual action.
