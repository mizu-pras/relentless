# Known Limitations Cleanup — Implementation Plan

> **For agentic workers:** REQUIRED: Use relentless pursuit loop for execution. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up 6 existing but disconnected features identified as Known Limitations across Sprints 1-4.

**Architecture:** These are all small, focused wiring fixes — no new modules or major features. Each fix connects existing tested code that was built but never invoked in production, or adds thin command wrappers for existing functions.

**Tech Stack:** TypeScript, Node.js, Relentless plugin system

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `lib/state.ts` | Modify | Wire `promoteToGlobal()` into `archiveCompleted()` |
| `lib/state.test.ts` | Modify | Add test for promotion during archive |
| `lib/jsonc.ts` | **Create** | Centralized string-aware JSONC parser |
| `lib/jsonc.test.ts` | **Create** | Tests for JSONC parser including URL edge cases |
| `lib/config.ts` | Modify | Import `parseJsonc` from `lib/jsonc.ts` |
| `lib/templates.ts` | Modify | Import `parseJsonc` from `lib/jsonc.ts` |
| `bin/relentless.ts` | Modify | Import `parseJsonc` from `lib/jsonc.ts` |
| `lib/branching.ts` | Modify | Add `maxBranches` param to `formatBranchList()` |
| `lib/branching.test.ts` | Modify | Update tests for new param |
| `commands/merge.md` | **Create** | `/merge` command wrapper |
| `commands/abandon.md` | **Create** | `/abandon` command wrapper |
| `commands/AGENTS.md` | Modify | Add `/merge` and `/abandon` |
| `skills/using-relentless/SKILL.md` | Modify | Add `/merge` and `/abandon` to command list |

**Not in scope:** KL-S3-2 (`updateActualCost` per-dispatch tracking — requires plugin SDK support not yet available), KL-S2-5 (health/recovery runtime extraction — consistent with skill-based architecture, lower ROI).

---

## Chunk 1: Wire `promoteToGlobal()` into `archiveCompleted()` (KL-S3-1)

**Priority:** HIGH — core cross-project learning feature is built but disconnected.

**Context:** `promoteToGlobal()` in `lib/lessons.ts:175` is tested and working. `archiveCompleted()` in `lib/state.ts:102-147` extracts lessons and clears context but never promotes to global. Config `lessons.share_globally` exists in `defaults.jsonc` (default: `false`).

### Files:
- Modify: `lib/state.ts`
- Modify: `lib/state.test.ts`

### Steps:

- [ ] **Step 1: Write the failing test in `lib/state.test.ts`**

  Test that `archiveCompleted()` calls `promoteToGlobal()` when `share_globally` is `true` in config. The test should:
  - Set up a pursuit state with a task
  - Create lessons with `frequency >= 3` and diverse sources (so they qualify for promotion)
  - Set config `lessons.share_globally: true`
  - Call `archiveCompleted()`
  - Assert that global lessons file was written with the promoted lesson
  
  Also test the negative case: when `share_globally` is `false` (default), `promoteToGlobal()` is NOT called.

- [ ] **Step 2: Run test to verify it fails**

  Run: `npm test`
  Expected: New test fails because `archiveCompleted()` doesn't call `promoteToGlobal()`

- [ ] **Step 3: Wire `promoteToGlobal()` into `archiveCompleted()`**

  In `lib/state.ts`, after the lesson extraction block (after line 132):
  - Import `promoteToGlobal` from `./lessons.js`
  - Import `loadConfig` from `./config.js`
  - Read config to check `lessons.share_globally`
  - If enabled, call `promoteToGlobal(projectDir, projectId)` where `projectId` is derived from `resolve(projectDir || ".").split("/").pop()` (basename of project directory)
  - Wrap in try/catch like the surrounding blocks — log warning on failure, don't break archive flow

- [ ] **Step 4: Run tests to verify they pass**

  Run: `npm test`
  Expected: All tests pass including new promotion test

- [ ] **Step 5: Commit**

  ```
  fix: wire promoteToGlobal into archiveCompleted (KL-S3-1)
  ```

### Chunk 1 Acceptance Gate
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] `archiveCompleted()` promotes lessons to global when `share_globally: true`
- [ ] `archiveCompleted()` does NOT promote when `share_globally: false` (default)
- [ ] Archive flow doesn't break if promotion fails (graceful degradation)

---

## Chunk 2: Extract `parseJsonc` to shared module (KL-1)

**Priority:** MEDIUM — fragile regex duplicated in 3 places, breaks on URLs in strings.

**Context:** Identical fragile regex `/\/\/.*$/gm` exists in `lib/config.ts:119`, `lib/templates.ts:33`, and inline in `bin/relentless.ts:183`. Would corrupt `"https://example.com"` → `"https:"`.

### Files:
- Create: `lib/jsonc.ts`
- Create: `lib/jsonc.test.ts`
- Modify: `lib/config.ts`
- Modify: `lib/templates.ts`
- Modify: `bin/relentless.ts`

### Steps:

- [ ] **Step 1: Write failing tests for `lib/jsonc.test.ts`**

  Test cases:
  - Basic JSONC with `//` line comments → parses correctly
  - JSONC with `/* */` block comments → parses correctly
  - JSONC with trailing commas → parses correctly
  - **String containing URL** (`"url": "https://example.com"`) → URL preserved, not stripped
  - **String containing `//` inside value** (`"note": "see // docs"`) → content preserved
  - Mixed: comments outside strings + URLs inside strings → correct parsing
  - Invalid JSON → throws error

- [ ] **Step 2: Run tests to verify they fail**

  Run: `npm test`
  Expected: Tests fail because `lib/jsonc.ts` doesn't exist

- [ ] **Step 3: Implement `lib/jsonc.ts`**

  Create a `parseJsonc(text: string): unknown` function that:
  1. Processes the text character by character (or with a state machine approach)
  2. Tracks whether currently inside a string (between unescaped `"`)
  3. Only strips `//` and `/* */` when NOT inside a string
  4. Removes trailing commas before `}` and `]`
  5. Passes result to `JSON.parse()`
  
  The function should be the single export. Keep it simple — a scanning approach that tracks `inString` state is sufficient.

- [ ] **Step 4: Run tests to verify they pass**

  Run: `npm test`
  Expected: All jsonc tests pass

- [ ] **Step 5: Replace in `lib/config.ts`**

  - Remove the private `parseJsonc` function (lines 117-123)
  - Add `import { parseJsonc } from "./jsonc.js";` at top
  - Ensure return type is cast to `JsonObject` at call site

- [ ] **Step 6: Replace in `lib/templates.ts`**

  - Remove the exported `parseJsonc` function (lines 32-38)
  - Add `import { parseJsonc } from "./jsonc.js";`
  - Re-export if needed: check if anything imports `parseJsonc` from `templates.ts`

- [ ] **Step 7: Replace in `bin/relentless.ts`**

  - Replace the inline strip+parse at line 183 with `parseJsonc(text)`
  - Import from the appropriate path (bin has separate tsconfig, so may need relative path to `lib/dist/jsonc.js` or dynamic import)

- [ ] **Step 8: Run full test suite + build**

  Run: `npm run build && npm test`
  Expected: Everything passes. Existing config/template tests still work.

- [ ] **Step 9: Commit**

  ```
  refactor: extract parseJsonc to shared lib/jsonc.ts with string-aware parsing (KL-1)
  ```

### Chunk 2 Acceptance Gate
- [ ] `npm run build` passes (including `build:bin` if separate)
- [ ] `npm test` passes
- [ ] No duplicate `parseJsonc` implementations remain
- [ ] URLs inside JSONC string values are preserved
- [ ] `lib/config.ts`, `lib/templates.ts`, `bin/relentless.ts` all use the shared implementation

---

## Chunk 3: Add `/merge` and `/abandon` commands + fix `formatBranchList` (KL-4, KL-2)

**Priority:** MEDIUM — completes the branching command surface.

**Context:** `mergeBranch()` and `abandonBranch()` exist in `lib/branching.ts:178-194` with tests. Command wrappers `merge.md` and `abandon.md` are missing. `formatBranchList()` hardcodes `DEFAULT_MAX_BRANCHES` instead of accepting a parameter.

### Files:
- Create: `commands/merge.md`
- Create: `commands/abandon.md`
- Modify: `commands/AGENTS.md`
- Modify: `skills/using-relentless/SKILL.md`
- Modify: `lib/branching.ts`
- Modify: `lib/branching.test.ts`

### Steps:

- [ ] **Step 1: Create `commands/merge.md`**

  Follow the pattern of `commands/switch.md` (thin wrapper). Content:
  - Frontmatter: `name: merge`, `description: Merge a successful pursuit branch back into main pursuit`
  - Usage: `/merge <branch-id>`
  - Behavior: Marks branch as merged, cleans up worktree if applicable, restores main pursuit state
  - Prerequisites: Branch must be in `active` or `paused` status

- [ ] **Step 2: Create `commands/abandon.md`**

  Follow the same pattern. Content:
  - Frontmatter: `name: abandon`, `description: Abandon a pursuit branch and clean up its resources`
  - Usage: `/abandon <branch-id>`
  - Behavior: Marks branch as abandoned, removes worktree, preserves any lessons learned
  - Safety: Requires confirmation before cleanup

- [ ] **Step 3: Update `commands/AGENTS.md`**

  Add two entries to the Available Commands list:
  - `/merge`: merge a successful pursuit branch back into main pursuit
  - `/abandon`: abandon a pursuit branch and clean up resources

- [ ] **Step 4: Update `skills/using-relentless/SKILL.md`**

  Add `/merge` and `/abandon` to the orchestration commands line (line 13).

- [ ] **Step 5: Write test for `formatBranchList` with `maxBranches` param**

  In `lib/branching.test.ts`, add test:
  - Call `formatBranchList(branches, activeId, 5)` → output shows `x/5` not `x/3`
  - Call `formatBranchList(branches, activeId)` → default still shows `x/3` (backward compat)

- [ ] **Step 6: Run test to verify it fails**

  Run: `npm test`
  Expected: Fails — `formatBranchList` doesn't accept third param

- [ ] **Step 7: Add `maxBranches` parameter to `formatBranchList()`**

  In `lib/branching.ts:196`:
  - Change signature to `formatBranchList(branches, activeBranchId?, maxBranches = DEFAULT_MAX_BRANCHES)`
  - Replace `DEFAULT_MAX_BRANCHES` usage on line 215 with the `maxBranches` parameter

- [ ] **Step 8: Run tests to verify they pass**

  Run: `npm test`
  Expected: All tests pass

- [ ] **Step 9: Commit**

  ```
  feat: add /merge and /abandon commands, fix formatBranchList max branches display (KL-4, KL-2)
  ```

### Chunk 3 Acceptance Gate
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] `commands/merge.md` exists with proper structure
- [ ] `commands/abandon.md` exists with proper structure
- [ ] `commands/AGENTS.md` lists `/merge` and `/abandon`
- [ ] `skills/using-relentless/SKILL.md` lists `/merge` and `/abandon`
- [ ] `formatBranchList()` respects `maxBranches` parameter
- [ ] `formatBranchList()` defaults to 3 when param omitted (backward compat)

---

## Deferred Items (Not In Scope — Documented for Future)

### KL-S3-2: `updateActualCost()` per-dispatch tracking
**Why deferred:** Requires detecting per-agent token usage individually. Plugin SDK doesn't expose per-subagent completion hooks. Session-level `total_actual` is sufficient for cost overview. Would need SDK changes or heuristic estimation.

### KL-S2-5: Health/recovery runtime extraction
**Why deferred:** Current skill-based approach (markdown instructions executed by agents) is architecturally consistent with how all skills work. Extracting to `lib/health.ts` and `lib/recovery.ts` adds testable code but changes the execution model. Better addressed if/when Sprint 4.2 CI/CD headless mode needs `npx relentless health --headless` to run programmatically.

### KL-S3-4: `recordDispatch()` todo naming convention fragility
**Why deferred partially:** Scout found that `PursuitTodo` already has `agent?: string` field and the plugin already reads `todo.agent` rather than parsing content strings. The fragility is lower than initially documented. The remaining issue (falling back to `"deep"` for unknown agents) is acceptable default behavior.

---

## Known Framework Gotchas

| Framework | Gotcha | Impact |
|-----------|--------|--------|
| TypeScript | `import` from `.js` extension required in ESM output | Import paths must use `.js` even for `.ts` source files |
| bin/ separate tsconfig | `bin/relentless.ts` compiles via `tsc -p bin/tsconfig.json`, not the main lib tsconfig | Must verify bin builds separately: `npm run build:bin` or `npm run build:all` |
| State test isolation | `state.test.ts` uses real filesystem — tests must clean up temp dirs | Use `mkdtempSync` for isolated test dirs |

---

## Execution Order

```
Chunk 1 (KL-S3-1: promoteToGlobal wiring)    [~30 min]
    ↓
Chunk 2 (KL-1: parseJsonc extraction)         [~45 min]
    ↓
Chunk 3 (KL-4 + KL-2: commands + formatting)  [~30 min]
```

Total estimated effort: ~2 hours

Chunks are independent (no shared files), but sequential execution is recommended for a single agent to maintain context.
