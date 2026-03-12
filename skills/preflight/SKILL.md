---
name: preflight
description: Use before reconnaissance or dispatch to verify dependencies, toolchain, build output, and relentless state integrity.
---

# Preflight - Environment Health Gate

Run this before pursuit work so failures are caught early, not after token-heavy dispatch.

## Goal

Verify minimum environment health for orchestration. If any required check fails, stop dispatch and report fixes to Conductor.

## Check Matrix

| Check | Method | Pass Criteria | Failure Action |
|------|--------|---------------|----------------|
| Node.js dependencies | Compare mtimes of `package-lock.json` and `node_modules/` | `node_modules/` exists and is newer than or equal to lockfile | Run `npm ci` (preferred) or `npm install` |
| Required CLI tools | `command -v tsc git npm` | All three resolve on PATH | Install missing tool(s), then re-run preflight |
| Build output | Check `lib/dist/` | Directory exists | Run `npm run build` |
| Config integrity | Parse `defaults.jsonc` as JSONC | Parse succeeds with no syntax error | Fix JSONC syntax and re-run |
| Pursuit state integrity | If `.relentless/current-pursuit.json` exists, parse as JSON | Valid JSON or file absent | Warn Conductor, offer `rm .relentless/current-pursuit.json` if corrupted |

## Procedure

1. Check `.relentless/halt`. If present, stop immediately and report.
2. Run each check in the matrix and collect pass/fail evidence.
3. For dependency freshness:
   - If `node_modules/` is missing -> fail.
   - If `package-lock.json` is newer than `node_modules/` -> stale dependency fail.
4. For CLI tools, require all commands to resolve via `command -v`.
5. For config/state parsing, distinguish missing file vs parse error; parse errors are failures.

## Failure Handling

If any required check fails:

1. Report findings to Conductor with failing checks and exact evidence.
2. Provide concrete fix commands for each failure.
3. Mark preflight as BLOCKED.
4. Do NOT proceed to scout reconnaissance or implementation dispatch until resolved.

If only pursuit state is corrupted, warn and request explicit approval from Conductor before removing the file.

## Success Criteria

Preflight passes only when all required checks pass, or an approved remediation is applied and validated by re-running failed checks.
