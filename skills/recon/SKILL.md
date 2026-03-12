---
name: recon
description: Use when /recon command is invoked. Scans the codebase and generates, audits, or improves AGENTS.md files hierarchically throughout the project.
---

# Recon — Codebase Mapping

Map the territory before agents work in it. AGENTS.md files give every agent instant context without scanning the whole codebase.

## Modes

```
/recon                  → Generate mode: scan + create new AGENTS.md files
/recon --audit          → Audit mode: score existing AGENTS.md quality
/recon --improve        → Improve mode: audit + propose targeted improvements
/recon --update         → Update mode: refresh AGENTS.md based on recent changes
/recon --dirty          → Dirty mode: update only AGENTS.md files marked dirty by doc-tracker
/recon --max-depth=N    → Limit scan depth (default: 4)
```

## Phase 1: Discovery (Scout)

Dispatch Scout to:
1. Scan directory tree up to `max-depth`
2. Find all existing AGENTS.md files
3. Identify candidate directories (see criteria below)

**Empty project check:** If no source files found, report: "No codebase found. Initialize your project first."

**Candidate directory criteria (ANY of these qualifies):**
- Contains 3+ source files (not config, not test files)
- Contains files of mixed types/concerns
- Is a named domain directory: `api`, `components`, `lib`, `services`, `utils`, `hooks`, `store`, `db`, `auth`, `models`, `routes`, `middleware`, `types`, `schemas`
- Already has an AGENTS.md (always include for audit)
- Is the project root (always include)

**Always exclude:** `node_modules/`, `.git/`, `dist/`, `build/`, `coverage/`, `.next/`, `.nuxt/`, hidden dirs (`.foo`) except `.opencode/`

## Phase 2: Analysis (Scout + Conductor)

For each candidate directory, Scout should detect:
- **Tech stack:** frameworks, languages, libraries used
- **Conventions:** naming patterns, file organization
- **Commands:** build/test/dev commands (from package.json, Makefile, etc.)
- **Dependencies:** key packages from package.json / requirements.txt / go.mod / Cargo.toml
- **Environment variables:** from .env.example, README, or config files
- **Non-obvious patterns:** gotchas, quirks, undocumented behavior
- **Dirty status:** Check doc-tracker for dirty AGENTS.md files in this directory via `isDirtyDoc()`

## Phase 3: Quality Assessment (--audit / --improve modes)

Score each existing AGENTS.md using `references/quality-criteria.md`.

Output a quality report BEFORE making any changes:

```
## Recon Report

### Summary
- Directories scanned: N
- AGENTS.md found: N
- AGENTS.md missing (recommended): N
- Average score: N/100 (Grade X)

### File-by-File Assessment

#### ./AGENTS.md (Root) — Score: 85/100 (B)
| Criterion              | Score | Notes |
| Tech stack/conventions | 18/20 | Missing database info |
| Architecture clarity   | 17/20 | Outdated directory structure |
...

Issues:
- [specific problem]

Recommended additions:
- [specific addition]
```

## Phase 4: Propose Changes (--improve mode)

Show diffs for each proposed change BEFORE applying:

```
### Update: ./src/api/AGENTS.md

Why: Database connection pattern undocumented, agents generate incorrect DB code.

+ ## Database
+ - ORM: Drizzle with PostgreSQL
+ - Connection: Pool via `src/lib/db.ts`
```

Ask for user approval before applying.

## Phase 5: Apply (after approval)

Apply using Edit tool. Preserve existing content structure.

## Doc-Tracker Integration

Recon integrates with the documentation dirty-tracker (`lib/doc-tracker.ts`) to know which AGENTS.md files have become stale after code changes.

### How It Works

1. **During `--update` mode:** Before scanning, read `readDirtyDocs()` to check for dirty AGENTS.md files. Prioritize updating these files first. After successfully updating an AGENTS.md, call `resolveDoc(projectDir, agentsMdPath, "recon")` to mark it as resolved.

2. **During `--dirty` mode:** Only update AGENTS.md files that are marked dirty. Skip all clean files.
   - Read dirty docs via `readDirtyDocs()` or `getDirtyDocsByFile()`
   - Filter to only AGENTS.md files (ignore other doc types)
   - For each dirty AGENTS.md: re-scan its directory, regenerate content, apply update
   - After each successful update: `resolveDoc(projectDir, path, "recon")`
   - Report: which files were updated, which were resolved, which remain dirty

3. **During `--audit` mode:** Include dirty-doc status in the quality report. An AGENTS.md that is marked dirty gets a penalty in the Currency score (it's known to be outdated).

4. **After any AGENTS.md update (all modes):** Always call `resolveDoc()` for the updated file. This ensures the dirty tracker stays in sync.

### Dirty Mode Workflow

```
/recon --dirty

Phase 1: Read dirty docs from doc-tracker
Phase 2: Filter to AGENTS.md files only
Phase 3: For each dirty AGENTS.md:
  a. Re-scan the directory
  b. Detect changes since last update
  c. Regenerate/update content
  d. Apply changes
  e. resolveDoc() to mark as resolved
Phase 4: Report results
```

### Quality Report Enhancement (--audit)

Add to the file-by-file assessment:

```
#### ./lib/AGENTS.md — Score: 72/100 (B)
⚠️ Dirty: marked stale by doc-tracker (triggered by lib/doc-tracker.ts modification)
```

## AGENTS.md Content Template

Read `references/templates.md` for templates per project type.

Each AGENTS.md should be:
- **Concise:** 50-150 lines max
- **Actionable:** All commands copy-pasteable
- **Specific:** Project-specific patterns, not generic advice
- **Current:** Accurate to the current codebase state
