# Relentless Sprint Roadmap

**Date:** 2026-03-12
**Status:** Approved — Ready for Execution
**Context:** Feature gap analysis based on full codebase reconnaissance
**Execution:** Each sprint = 1 `/unleash` session (new session per sprint)

---

## Current State Summary

Relentless v0.1.0 is production-ready with:
- 6 commands, 18 skills, 6 agents, 8 lib modules
- Full orchestration pipeline: brainstorming → planning → dispatch → pursuit → verification
- 8/9 modules with unit tests (plugin entrypoint untested)
- Token optimization: differential compaction, lessons learning, doc-tracking

What follows is a 4-sprint plan to take Relentless from v0.1.0 to v0.2.0.

---

## Sprint 1: Quick Wins & Foundations

**Theme:** Wire up existing code that was built but never connected, fix DX gaps.
**Estimated effort:** ~3-4 hours
**Version target:** v0.1.1
**Status:** ✅ Complete — committed as `fd29f86`

### 1.1 Auto-Archive Pursuit on Completion

**Problem:** `archiveCompleted()` exists in `state.ts` (tested, working) but is never called automatically. Pursuit state accumulates in `current-pursuit.json` indefinitely.

**What to do:**
- In the `pursuit` skill (`skills/pursuit/SKILL.md`), add instruction for agents to call archive after pursuit completes
- In the `unleash` skill (`skills/unleash/SKILL.md`), add archive step in Phase 8 (completion)
- In the `finishing-a-development-branch` skill, add archive as part of branch completion
- Verify `archiveCompleted()` correctly: extracts lessons, clears shared context, moves state to `history/`

**Files to touch:**
- `skills/pursuit/SKILL.md`
- `skills/unleash/SKILL.md`
- `skills/finishing-a-development-branch/SKILL.md`

**Acceptance criteria:**
- After a pursuit reaches 100% completion, state is automatically archived
- Lessons are extracted from error-log before archive
- `current-pursuit.json` is removed after successful archive
- `.relentless/history/` contains the archived pursuit JSON

---

### 1.2 Wire File Ownership into Conductor Dispatch

**Problem:** `assignFiles()`, `releaseFiles()`, `isFileAssigned()` exist in `state.ts` (tested, working) but Conductor's dispatch Phase 4-5 doesn't use them. Two agents could edit the same file concurrently.

**What to do:**
- Update `conductor.md` agent definition to include file ownership protocol in dispatch instructions
- Add pre-dispatch ownership check: before dispatching an agent, assign files via `assignFiles()`
- Add post-dispatch release: after agent completes, release files via `releaseFiles()`
- Add conflict detection: if a task requires a file currently assigned, queue it
- Update the `unleash` skill Phase 4 (file ownership) and Phase 5 (dispatch) with concrete instructions

**Files to touch:**
- `agents/conductor.md`
- `skills/unleash/SKILL.md`

**Acceptance criteria:**
- Conductor assigns files before dispatching agents
- No two agents are assigned the same file simultaneously
- File assignments are persisted in `.relentless/agent-assignments.json`
- Assignments are released when agent completes

---

### 1.3 `/history` Command — Pursuit History Viewer

**Problem:** `.relentless/history/` accumulates archived pursuit JSON files but there's no way to browse them.

**What to do:**
- Create `commands/history.md` — thin command wrapper
- Create `skills/history/SKILL.md` — skill that reads `.relentless/history/`, formats pursuit summaries
- Support flags: `--list` (default, show all), `--detail <id>` (show specific pursuit), `--stats` (aggregate statistics)
- Display: task name, date, completion status, number of todos completed, agents used, lessons learned

**Files to create:**
- `commands/history.md`
- `skills/history/SKILL.md`

**Files to update:**
- `skills/using-relentless/SKILL.md` (add `/history` to command list)
- `commands/AGENTS.md` (add history command)
- `skills/AGENTS.md` (add history skill)

**Acceptance criteria:**
- `/history` lists all archived pursuits with summary info
- `/history --detail <id>` shows full pursuit details
- `/history --stats` shows aggregate stats (total pursuits, avg completion, common error patterns)

---

### 1.4 Dependency Verification Skill

**Problem:** If a pursuit dispatches an agent that hits a missing package or tool, it wastes tokens discovering the error mid-execution. No standalone pre-flight check exists.

**What to do:**
- Create `skills/preflight/SKILL.md` — pre-pursuit dependency verification
- Checks: `package.json` dependencies installed (`node_modules` exists), required CLI tools available (tsc, git, npm), environment sanity checks
- Integrate into `unleash` skill Phase 3 (reconnaissance) as an explicit step
- Optionally run `npm install` or warn if deps are stale

**Files to create:**
- `skills/preflight/SKILL.md`

**Files to update:**
- `skills/unleash/SKILL.md` (add preflight step to Phase 3)
- `skills/AGENTS.md` (add preflight skill)
- `skills/using-relentless/SKILL.md` (add to skill index)

**Acceptance criteria:**
- Before any pursuit begins, dependencies are verified
- Missing packages are flagged before agent dispatch
- CLI tool availability is confirmed (tsc, git, npm at minimum)
- Clear error messages if pre-flight fails

---

### 1.5 Watch Mode for Development

**Problem:** No `npm run dev` script. Developers editing lib modules must manually rebuild.

**What to do:**
- Add `"dev": "tsc -p lib/tsconfig.json --watch"` to `package.json` scripts
- Optionally add `"dev:test": "tsc -p lib/tsconfig.json --watch & nodemon --watch lib/dist --exec 'npm run test:only'"` if nodemon is available

**Files to touch:**
- `package.json`

**Acceptance criteria:**
- `npm run dev` watches for changes and auto-rebuilds
- DX friction reduced for lib module development

---

### 1.6 ESLint Configuration

**Problem:** No linting configured. Style consistency depends on conventions alone.

**What to do:**
- Add minimal ESLint config for TypeScript (flat config format)
- Add `"lint"` and `"lint:fix"` scripts to `package.json`
- Add `eslint` and `@typescript-eslint/*` as devDependencies
- Keep rules minimal: no-unused-vars, consistent-type-imports, no-any (warn only)

**Files to create:**
- `eslint.config.js` (flat config)

**Files to update:**
- `package.json` (scripts + devDependencies)

**Acceptance criteria:**
- `npm run lint` runs ESLint on all `.ts` files in `lib/` and `.opencode/plugins/`
- No blocking errors on current codebase (warnings OK)
- CI-friendly (exit code 0 on pass, 1 on fail)

---

### Sprint 1 — Known Limitations & Follow-Up

Tercatat saat Sprint 1 selesai. Bisa dikerjakan di session berikutnya.

#### KL-S1-1: Step 6 salah posisi di finishing-a-development-branch

**Lokasi:** `skills/finishing-a-development-branch/SKILL.md` baris 229
**Masalah:** Step 6 (Relentless Pursuit Cleanup) terletak di bawah heading `## Integration` (line 218), bukan di bawah `## The Process` bersama Step 0-5. Agen yang membaca secara linear akan melihat Step 5 → Quick Reference → Common Mistakes → Red Flags → Integration → Step 6, yang membingungkan.
**Dampak:** Kosmetik — agent masih bisa menemukan Step 6, tapi hierarchy heading salah.
**Solusi:** Pindahkan `### Step 6: Relentless Pursuit Cleanup` ke sebelum `## Quick Reference` agar masuk dalam flow `## The Process`.
**Prioritas:** Low

#### KL-S1-2: Step 5 kontradiksi internal (pre-existing)

**Lokasi:** `skills/finishing-a-development-branch/SKILL.md` baris 163
**Masalah:** Step 5 header bilang "**For Options 1, 2, 4:**" (menyiratkan Option 2 menghapus worktree). Tapi:
- Common Mistakes (line 198): "Only cleanup for Options 1 and 4"
- Red Flags (line 216): "Clean up worktree for Options 1 & 4 only"
- Quick Reference table (line 183): Option 2 "Keep Worktree: ✓"
**Dampak:** Agent bisa bingung — ikut Step 5 header atau ikut tabel/red-flags?
**Solusi:** Ubah Step 5 "For Options 1, 2, 4" menjadi "For Options 1 and 4" agar konsisten.
**Prioritas:** Low

#### KL-S1-3: History skill referensi status `cancelled` yang belum formal

**Lokasi:** `skills/history/SKILL.md` baris 70
**Masalah:** Detail mode menampilkan todos dengan status `completed`, `pending`, `cancelled`. Tapi `PursuitTodo.status` di `lib/state.ts` hanya tipe `string` — hanya `completed`, `in_progress`, `pending` yang digunakan di codebase. `cancelled` belum pernah di-set oleh kode manapun.
**Dampak:** Tidak ada bug, tapi menampilkan status yang secara praktis tidak pernah muncul.
**Solusi:** Definisikan status sebagai union type di `PursuitTodo`, atau ubah history skill untuk menampilkan semua status yang ada (apapun string-nya).
**Prioritas:** Low

#### KL-S1-4: Preflight skill tidak punya command wrapper standalone

**Lokasi:** `skills/preflight/SKILL.md` — tidak ada `commands/preflight.md`
**Masalah:** Preflight hanya bisa dipanggil otomatis dari unleash Phase 3 atau manual via `relentless:preflight` skill. Tidak ada `/preflight` command langsung.
**Dampak:** User tidak bisa menjalankan preflight check secara ad-hoc tanpa memulai full `/unleash`.
**Solusi:** Buat `commands/preflight.md` thin wrapper, atau dokumentasikan bahwa preflight adalah sub-skill yang tidak memerlukan command sendiri.
**Prioritas:** Low

---

## Sprint 2: Reliability & Observability ✅

**Theme:** Strengthen the runtime with tests, health checks, and recovery mechanisms.
**Estimated effort:** ~5-6 hours
**Version target:** v0.1.2
**Depends on:** Sprint 1 completed
**Status:** Completed — commit `f0258c8`

### 2.1 Plugin Integration Tests

**Problem:** `.opencode/plugins/relentless.ts` (329 lines) is the only runtime code with zero tests. It's the most critical file — all hooks, injections, and event handling flow through it.

**What to do:**
- Create test harness that mocks OpenCode's plugin interface (`Plugin` type, hook callbacks)
- Test cases:
  - `config` hook sets conductor model correctly
  - `chat.message` hook rewrites slash-free commands ("unleash - task" → template)
  - `chat.message` hook ignores non-command messages
  - `experimental.chat.system.transform` injects bootstrap always
  - `experimental.chat.system.transform` injects heavy context only during active pursuit
  - `experimental.chat.system.transform` injects lessons from past pursuits
  - `experimental.session.compacting` preserves pursuit state with differential compaction
  - `experimental.session.compacting` falls back gracefully on module failure
  - `event` handler tracks token usage on `message.updated`
  - `event` handler records failures on `session.error`
  - `event` handler syncs state on `session.idle`
  - Circuit breaker integration: token budget triggers stall
  - Path traversal guard prevents skill/command path escape

**Files to create:**
- `.opencode/plugins/relentless.test.ts` (or `lib/plugin.test.ts` depending on tsconfig scope)

**Files to update:**
- `package.json` (add plugin test to test script)
- `lib/tsconfig.json` (may need to include plugin path)

**Acceptance criteria:**
- All hook behaviors are tested with mocks
- Edge cases covered: missing skills, missing state, corrupted JSONL
- `npm test` includes plugin tests
- >90% line coverage on plugin entrypoint

---

### 2.2 Pursuit Analytics & Metrics

**Problem:** No visibility into historical performance. Can't answer: "How many pursuits succeeded?", "Which agent fails most?", "What's average token cost?"

**What to do:**
- Create `lib/metrics.ts` — analytics module that reads `.relentless/history/` and `lessons.jsonl`
- Metrics to compute:
  - Total pursuits, completion rate, average todos per pursuit
  - Agent performance: dispatch count per agent, success rate per agent
  - Error patterns: most common error categories, resolution rate
  - Token efficiency: estimated tokens per completed todo
  - Time patterns: average pursuit duration (from timestamps)
- Create `commands/metrics.md` and `skills/metrics/SKILL.md`
- Support output formats: terminal summary, detailed breakdown

**Files to create:**
- `lib/metrics.ts`
- `lib/metrics.test.ts`
- `commands/metrics.md`
- `skills/metrics/SKILL.md`

**Files to update:**
- `package.json` (add metrics test)
- `skills/using-relentless/SKILL.md` (add `/metrics` to command list)
- `commands/AGENTS.md`
- `skills/AGENTS.md`
- `lib/AGENTS.md`

**Acceptance criteria:**
- `/metrics` displays pursuit analytics summary
- Metrics computed from real archived pursuit data
- Module has unit tests with fixture data
- Handles empty history gracefully (no pursuits yet)

---

### 2.3 Rollback/Recovery Skill

**Problem:** When a pursuit fails catastrophically (circuit breaker trips, agent produces garbage), there's no structured recovery. User must manually clean up state and undo changes.

**What to do:**
- Create `skills/recovery/SKILL.md` — structured recovery protocol
- Recovery actions:
  1. **State cleanup:** Reset `current-pursuit.json`, clear stale `agent-assignments.json`
  2. **Git rollback:** Identify pre-pursuit commit, offer `git reset --soft` to it (preserve changes in staging) or `git stash`
  3. **Partial preservation:** Extract completed work from pursuit state, create recovery report
  4. **Lessons extraction:** Even from failed pursuit, extract any lessons before cleanup
  5. **Health check:** Verify plugin state is clean after recovery
- Create `commands/recover.md` — `/recover` command
- Support modes: `--soft` (clean state, keep code), `--hard` (clean state + git reset), `--report` (just show what happened)

**Files to create:**
- `skills/recovery/SKILL.md`
- `commands/recover.md`

**Files to update:**
- `skills/using-relentless/SKILL.md` (add `/recover` to command list)
- `commands/AGENTS.md`
- `skills/AGENTS.md`

**Acceptance criteria:**
- `/recover --soft` cleans up pursuit state without touching code
- `/recover --hard` offers git-based rollback with confirmation
- `/recover --report` shows what happened in the failed pursuit
- Lessons are preserved even from failed pursuits

---

### 2.4 Plugin Health Check

**Problem:** If symlinks break, skill files go missing, or state gets corrupted, errors are cryptic and unrecoverable. No diagnostic tool exists.

**What to do:**
- Create `skills/health/SKILL.md` — diagnostic skill
- Create `commands/health.md` — `/health` command
- Checks to perform:
  1. **Symlinks:** All expected symlinks exist and point to valid targets (agents, commands, skills, plugin)
  2. **Skills integrity:** All SKILL.md files exist and are readable
  3. **State integrity:** `current-pursuit.json` is valid JSON (if exists), JSONL files parse correctly
  4. **Dependencies:** `node_modules` exists, `@opencode-ai/plugin` is installed
  5. **Build:** `lib/dist/` exists and is up-to-date relative to `lib/*.ts` sources
  6. **Config:** Config files parse as valid JSONC
- Self-repair: Option to fix broken symlinks, rebuild if stale, clean corrupted state
- Output: Green/red checklist of all checks

**Files to create:**
- `skills/health/SKILL.md`
- `commands/health.md`

**Files to update:**
- `skills/using-relentless/SKILL.md`
- `commands/AGENTS.md`
- `skills/AGENTS.md`

**Acceptance criteria:**
- `/health` runs all checks and displays results
- Broken symlinks are identified with fix suggestions
- Corrupted state files are identified
- Self-repair available for common issues (missing symlinks, stale build)

---

### Sprint 2 — Known Limitations & Follow-Up

Tercatat saat Sprint 2 selesai. Bisa dikerjakan di session berikutnya.

#### KL-S2-1: Token efficiency metric belum diimplementasi

**Lokasi:** `lib/metrics.ts`
**Masalah:** Bagian "What to do" di plan menyebutkan "Token efficiency: estimated tokens per completed todo" sebagai salah satu metrik yang harus dihitung. Metrik ini belum diimplementasi di `computeMetrics()`.
**Dampak:** `/metrics` tidak menampilkan cost-per-todo. Namun ini TIDAK ada di acceptance criteria — hanya di deskripsi "What to do".
**Solusi:** Tambahkan field `token_efficiency` ke `FullMetrics`. Hitung dari `token_tracking` di archived pursuit state (perlu Sprint 3 item 3.3 Cost Tracking yang menambahkan `token_tracking` ke pursuit state).
**Prioritas:** Low — akan terselesaikan secara natural oleh Sprint 3 item 3.3.

#### KL-S2-2: Time patterns metric belum diimplementasi

**Lokasi:** `lib/metrics.ts`
**Masalah:** Bagian "What to do" menyebutkan "Time patterns: average pursuit duration (from timestamps)" sebagai metrik yang harus dihitung. Belum diimplementasi.
**Dampak:** `/metrics` tidak menampilkan durasi rata-rata pursuit. TIDAK ada di acceptance criteria.
**Solusi:** Hitung dari `updated_at` (atau `created_at` jika ditambahkan) vs `archived_at` di archived pursuit JSON. Bisa dikerjakan standalone tanpa dependency Sprint 3.
**Prioritas:** Low

#### KL-S2-3: Plugin test coverage belum diukur secara formal

**Lokasi:** `.opencode/plugins/relentless.test.ts`
**Masalah:** Acceptance criteria menyebutkan ">90% line coverage on plugin entrypoint". Semua hooks dan edge cases sudah ditest (10 test cases), tapi tidak ada coverage tool (c8/istanbul) yang terkonfigurasi untuk membuktikan angka persis.
**Dampak:** Klaim coverage berdasarkan analisis manual, bukan tool output. Secara praktis semua path penting ter-cover.
**Solusi:** Tambahkan `c8` sebagai devDependency dan buat script `test:coverage` yang menjalankan plugin tests dengan coverage report. Contoh: `"test:coverage": "c8 node .opencode/dist/relentless.test.js"`
**Prioritas:** Low

#### KL-S2-4: Recovery skill belum ada runtime code (hanya instruksi markdown)

**Lokasi:** `skills/recovery/SKILL.md`, `commands/recover.md`
**Masalah:** Recovery skill adalah instruksi markdown yang akan diikuti oleh agent saat dipanggil. Tidak ada `lib/recovery.ts` runtime module — semua logic dijalankan langsung oleh agent menggunakan tools (fs read/write, git commands). Ini konsisten dengan bagaimana skills lain (history, health) bekerja di Relentless, tapi berarti tidak ada unit-testable code untuk recovery.
**Dampak:** Tidak bisa unit-test recovery flow. Hanya bisa ditest secara end-to-end saat agent menjalankan `/recover`.
**Solusi:** Jika diinginkan testability, extract core logic (state cleanup, archive-before-delete, git commit finder) ke `lib/recovery.ts` dengan unit tests. Tapi ini bukan requirement di sprint plan.
**Prioritas:** Low — arsitektur konsisten dengan desain skill-based yang ada.

#### KL-S2-5: Health skill belum ada runtime code (hanya instruksi markdown)

**Lokasi:** `skills/health/SKILL.md`, `commands/health.md`
**Masalah:** Sama seperti KL-S2-4 — health check adalah instruksi markdown tanpa runtime module.
**Dampak:** Sama — tidak unit-testable. Agent menjalankan checks secara langsung.
**Solusi:** Sama — extract ke `lib/health.ts` jika testability diinginkan. Bisa jadi kandidat Sprint 4 item 4.2 (CI/CD headless mode) yang membutuhkan `npx relentless health --headless`.
**Prioritas:** Medium — akan dibutuhkan oleh Sprint 4.2.

---

## Sprint 3: Intelligence & Learning

**Theme:** Make Relentless smarter over time — learn from history, share knowledge, optimize routing.
**Estimated effort:** ~6-8 hours
**Version target:** v0.1.3
**Depends on:** Sprint 2 completed (needs metrics module + history data)

### 3.1 Smart Agent Selection (Learning-Based Routing)

**Problem:** Category routing is static (`deep→artisan`, `visual→maestro`). No learning from actual performance. If Sentinel turns out better for certain refactoring types, routing doesn't adapt.

**What to do:**
- Extend `lib/lessons.ts` with agent performance tracking:
  - Track: which agent was dispatched, task category, success/failure, retry count, estimated token cost
  - Store as new lesson category: `agent_performance`
- Create `lib/routing.ts` — smart routing module:
  - Default: use static category routing from `defaults.jsonc`
  - Override: if historical data shows agent X outperforms default for task pattern Y, suggest override
  - Confidence threshold: only override after N=5 data points for same pattern
  - Fallback: always fall back to static routing if insufficient data
- Integrate into Conductor's dispatch logic (Phase 5 of unleash)
- Add config option: `routing.learning_enabled: true` (default false, opt-in)

**Files to create:**
- `lib/routing.ts`
- `lib/routing.test.ts`

**Files to update:**
- `lib/lessons.ts` (add `agent_performance` category)
- `lib/lessons.test.ts` (new test cases)
- `defaults.jsonc` (add `routing` config section)
- `agents/conductor.md` (reference smart routing)
- `skills/unleash/SKILL.md` (Phase 5 routing logic)
- `lib/AGENTS.md`

**Acceptance criteria:**
- Static routing works as before when learning is disabled
- Agent performance is tracked per dispatch
- After N=5 data points, routing suggestions appear in Conductor context
- Conductor can accept or override suggestions
- Module has unit tests with fixture data

---

### 3.2 Cross-Project Lessons Sharing

**Problem:** Lessons are project-local (`.relentless/lessons.jsonl`). Universal gotchas discovered in project A (e.g., "TypeScript 5.8 changed import resolution behavior") don't benefit project B.

**What to do:**
- Create global lessons store: `~/.config/opencode/relentless/global-lessons.jsonl`
- Lesson promotion logic:
  - When a lesson's frequency reaches N=3 AND it appears in M=2 different projects, auto-promote to global
  - Global lessons have a `source_projects: string[]` field
  - Lesson deduplication across projects uses normalized pattern matching (already exists)
- Sync mechanism:
  - On pursuit start: merge relevant global lessons into project context
  - On pursuit archive: check if any project lessons qualify for promotion
- Privacy: opt-in via config `lessons.share_globally: false` (default off)
- Global lessons are filtered by tech stack: only inject lessons relevant to current project's framework/language

**Files to update:**
- `lib/lessons.ts` (add global store functions, promotion logic, merge)
- `lib/lessons.test.ts` (new test cases for global lessons)
- `defaults.jsonc` (add `lessons.share_globally` option)
- `.opencode/plugins/relentless.ts` (inject global lessons in system prompt)
- `lib/AGENTS.md`

**Acceptance criteria:**
- Global lessons file created at `~/.config/opencode/relentless/global-lessons.jsonl`
- Lessons promoted when frequency >= 3 AND seen in >= 2 projects
- Global lessons injected only when relevant to current project's stack
- Opt-in via config (default off)
- Existing project-local lesson behavior unchanged
- Unit tests cover promotion, merge, and deduplication

---

### 3.3 Cost Tracking & Estimation

**Problem:** Token budget module estimates dispatch costs but doesn't persist or report. No way to know how much a pursuit "cost" after the fact.

**What to do:**
- Extend `lib/token-budget.ts` with cost persistence:
  - Track per-dispatch: agent, estimated cost, actual tokens (from event handler)
  - Store in pursuit state under `token_tracking: { dispatches: [...], total_estimated, total_actual }`
- Extend `lib/metrics.ts` (from Sprint 2) with cost analytics:
  - Average cost per pursuit, per agent, per todo
  - Cost trend over time
  - Token efficiency improvements from lessons
- Add cost summary to pursuit archive
- Display in `/metrics` output and `/status` output

**Files to update:**
- `lib/token-budget.ts` (add cost persistence)
- `lib/token-budget.test.ts` (new tests)
- `lib/state.ts` (extend PursuitState interface with `token_tracking`)
- `lib/metrics.ts` (add cost analytics, depends on Sprint 2)
- `.opencode/plugins/relentless.ts` (persist actual token counts to state)
- `lib/AGENTS.md`

**Acceptance criteria:**
- Every dispatch's estimated and actual token cost is recorded
- `/metrics` shows cost breakdown by agent and pursuit
- `/status` shows current pursuit's running cost
- Cost data persisted in archived pursuits for historical analysis

---

## Sprint 4: Advanced Capabilities ✅

**Theme:** Power-user features that expand what Relentless can do in complex scenarios.
**Estimated effort:** ~8-10 hours
**Version target:** v0.2.0
**Depends on:** Sprint 3 completed
**Status:** Complete — v0.2.0

### 4.1 Pursuit Templates

**Problem:** Every pursuit starts from scratch — brainstorming, planning, dispatch. For common task types (API endpoint, React component, database migration, refactoring), much of the planning is repetitive.

**What to do:**
- Create template system:
  - Templates live in `templates/` directory as `.jsonc` files
  - Each template defines: task pattern, default todos, suggested agents, typical files, skip flags
  - Built-in templates: `api-endpoint`, `ui-component`, `refactoring`, `migration`, `test-suite`, `bugfix`
- Template matching:
  - During `/unleash`, after intent classification, check if task matches a template pattern
  - Offer to use template or proceed with full brainstorming
  - Templates can be customized per-project via `.opencode/relentless-templates/`
- Template application:
  - Pre-populates pursuit state with todos from template
  - Sets suggested agent assignments
  - Can optionally skip brainstorming and/or planning phases

**Files to create:**
- `templates/api-endpoint.jsonc`
- `templates/ui-component.jsonc`
- `templates/refactoring.jsonc`
- `templates/migration.jsonc`
- `templates/test-suite.jsonc`
- `templates/bugfix.jsonc`
- `lib/templates.ts` (template loading, matching, application)
- `lib/templates.test.ts`

**Files to update:**
- `skills/unleash/SKILL.md` (add template matching step after intent classification)
- `defaults.jsonc` (add `templates` config section)
- `lib/AGENTS.md`

**Acceptance criteria:**
- 6 built-in templates available
- Template matching suggests relevant template during `/unleash`
- Templates pre-populate todos and agent assignments
- User can override or skip templates
- Project-level template overrides supported
- Unit tests for template loading and matching

---

### 4.2 CI/CD Integration (Headless Mode)

**Problem:** Relentless is interactive-only. Can't run `/recon` or verification as part of CI pipeline.

**What to do:**
- Create headless execution mode:
  - `npx relentless recon --headless --output=agents-report.json` — run recon without interactive session
  - `npx relentless health --headless --exit-code` — run health check, exit 0/1
  - `npx relentless verify --headless` — run verification checks on current codebase
- Create CLI entrypoint: `bin/relentless.ts` (or `bin/relentless.js`)
- Headless commands available:
  - `recon` — generate/update AGENTS.md files
  - `health` — run health checks (from Sprint 2)
  - `verify` — run chunk-gate verification commands
  - `metrics` — output metrics as JSON
- GitHub Actions workflow template: `.github/workflows/relentless-recon.yml`

**Files to create:**
- `bin/relentless.ts` (CLI entrypoint)
- `templates/github-actions/relentless-recon.yml` (example workflow)

**Files to update:**
- `package.json` (add `"bin"` field, add CLI build step)
- `lib/tsconfig.json` (include bin directory)

**Acceptance criteria:**
- `npx relentless recon --headless` runs without interactive session
- `npx relentless health --headless --exit-code` returns proper exit codes
- JSON output mode for CI consumption
- GitHub Actions template provided
- Works with both npm and bun runtimes

---

### 4.3 Pursuit Branching (Experimental)

**Problem:** When a pursuit's approach isn't working, the only option is to recover and start over. No way to explore an alternative approach while preserving the original.

**What to do:**
- Implement pursuit branching:
  - `/branch "try alternative approach"` — creates a new pursuit branch from current state
  - Uses git worktrees under the hood (leverages existing `using-git-worktrees` skill)
  - Branch state: copies `current-pursuit.json` to new branch with modified task
  - Original pursuit is paused (not halted — can be resumed)
- Branch management:
  - `/branches` — list active pursuit branches
  - `/switch <branch>` — switch to a different pursuit branch
  - `/merge <branch>` — merge successful branch back into main pursuit
  - `/abandon <branch>` — discard branch and clean up worktree
- State management:
  - Each branch gets its own `.relentless/` state directory (via worktree isolation)
  - Branch metadata stored in `.relentless/branches.json` in the main worktree
  - Maximum 3 concurrent branches (prevent resource sprawl)

**Files to create:**
- `commands/branch.md`
- `commands/branches.md`
- `commands/switch.md`
- `skills/branching/SKILL.md`
- `lib/branching.ts` (branch state management)
- `lib/branching.test.ts`

**Files to update:**
- `skills/using-relentless/SKILL.md` (add branching commands)
- `commands/AGENTS.md`
- `skills/AGENTS.md`
- `lib/AGENTS.md`
- `defaults.jsonc` (add `branching` config section)

**Acceptance criteria:**
- `/branch` creates isolated pursuit branch with worktree
- `/branches` lists active branches with status
- `/switch` seamlessly switches between branches
- `/merge` integrates successful branch
- Maximum 3 concurrent branches enforced
- Branch cleanup removes worktree and state
- Unit tests for branch state management

---

## Sprint Execution Protocol

### How to Run Each Sprint

Each sprint is a single `/unleash` session in a fresh context:

```
/unleash "Execute Sprint N from docs/plans/2026-03-12-sprint-roadmap.md — implement all items in Sprint N"
```

### Pre-Sprint Checklist

Before starting any sprint:
1. Verify previous sprint is complete: `npm test` passes, `npm run build` succeeds
2. All previous sprint items are committed
3. Run `/health` (after Sprint 2) to verify plugin state
4. Read this roadmap to refresh context

### Post-Sprint Checklist

After completing each sprint:
1. All acceptance criteria met
2. `npm test` passes (including new tests)
3. `npm run build` succeeds
4. Update `package.json` version
5. Commit with message: `feat: Sprint N complete — <theme summary>`
6. Update this roadmap's sprint status to ✅

### Sprint Dependencies

```
Sprint 1 (Quick Wins)
    ↓
Sprint 2 (Reliability)  ← needs history/ from 1.3, preflight from 1.4
    ↓
Sprint 3 (Intelligence) ← needs metrics from 2.2, plugin tests from 2.1
    ↓
Sprint 4 (Advanced)     ← needs all prior sprints
```

---

## Version Changelog Plan

| Version | Sprint | Key Changes |
|---------|--------|-------------|
| v0.1.1 | Sprint 1 | Auto-archive, file ownership, /history, preflight, DX improvements |
| v0.1.2 | Sprint 2 | Plugin tests, /metrics, /recover, /health |
| v0.1.3 | Sprint 3 | Smart routing, global lessons, cost tracking |
| v0.2.0 | Sprint 4 | Templates, CI/CD headless mode, pursuit branching |

---

## Open Questions (To Resolve During Execution)

These are inherited from the original design spec and should be resolved as they're encountered:

1. **Parallel dispatch verification** — Does dispatching multiple Task tool calls in one message actually run them in parallel? Test empirically in Sprint 1.
2. **Token budget API availability** — Is context usage % available from `@opencode-ai/plugin` SDK? Verify in Sprint 2.
3. **GLM-5 (Scout) tool reliability** — How reliably does GLM-5 handle multi-step tool chains? Monitor during Sprint 1-2.
4. **Agent permission scoping** — Can agent `.md` definitions restrict tool access? Investigate in Sprint 4.

---

## Risk Register

| Risk | Impact | Mitigation |
|------|--------|------------|
| Plugin test harness complexity | Sprint 2 delay | Mock only essential hook interfaces, not full SDK |
| Smart routing insufficient data | Sprint 3 underperforms | Keep static routing as default, learning is opt-in |
| Pursuit branching state complexity | Sprint 4 scope creep | Mark as experimental, limit to 3 branches |
| CI/CD headless mode scope | Sprint 4 may be too large | Start with recon + health only, defer verify + metrics |
| Cross-project lessons privacy | User trust concern | Default off, explicit opt-in, no cloud sync |

---

## Sprint 4 — Known Limitations & Follow-Up

Tercatat saat Sprint 4 selesai. Bisa dikerjakan di session berikutnya.

### KL-1: `parseJsonc` rusak kalau ada URL di dalam string value

**Lokasi:** `lib/templates.ts:33`, `lib/config.ts:93`, `bin/relentless.ts:183` (inline)
**Masalah:** Regex `/\/\/.*$/gm` menganggap `//` di dalam string (misal `"https://example.com"`) sebagai komentar, sehingga string terpotong dan JSON gagal parse.
**Dampak:** Belum ada file JSONC yang mengandung URL, jadi belum pernah terjadi. Tapi akan jadi masalah kalau template atau config mulai pakai URL.
**Solusi:** Ekstrak ke `lib/jsonc.ts` sebagai shared utility, ganti regex dengan parser yang sadar konteks string (skip content di dalam quotes). Sekaligus menghapus duplikasi di 3 tempat (DRY).
**Prioritas:** Medium

### KL-2: `formatBranchList` hardcode max branches = 3

**Lokasi:** `lib/branching.ts` — `formatBranchList()`
**Masalah:** Selalu menampilkan `x/3` walaupun config `branching.max_branches` diset ke angka lain.
**Dampak:** Tampilan saja, data tetap benar. Max branch enforcement di `createBranch()` sudah membaca registry value dengan benar.
**Solusi:** Tambah parameter `maxBranches: number` ke `formatBranchList()`, default ke `DEFAULT_MAX_BRANCHES` untuk backward compatibility. Update caller di skill.
**Prioritas:** Low

### KL-3: `npm test` tidak compile `bin/`

**Lokasi:** `package.json` scripts
**Masalah:** `npm test` hanya build `lib/` dan menjalankan test. CLI di `bin/` di-compile terpisah via `npm run build:bin` atau `npm run build:all`.
**Dampak:** Kalau ada perubahan di `bin/relentless.ts` yang bikin compile error, `npm test` tidak akan menangkap.
**Solusi:** Tambahkan `tsc -p bin/tsconfig.json` ke script `test`, atau buat `test:bin` terpisah untuk verify compile.
**Prioritas:** Low

### KL-4: Pursuit branching belum ada command `/merge` dan `/abandon`

**Lokasi:** `commands/` — hanya ada `branch.md`, `branches.md`, `switch.md`
**Masalah:** Fungsi `mergeBranch()` dan `abandonBranch()` sudah ada di `lib/branching.ts` (tested), tapi command wrapper `.md` untuk `/merge` dan `/abandon` belum dibuat.
**Dampak:** Merge dan abandon hanya bisa dilakukan melalui skill instructions di `skills/branching/SKILL.md`, bukan via slash command langsung.
**Solusi:** Buat `commands/merge.md` dan `commands/abandon.md`, update `commands/AGENTS.md` dan `skills/using-relentless/SKILL.md`.
**Prioritas:** Medium
