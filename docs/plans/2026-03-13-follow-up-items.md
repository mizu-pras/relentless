# Follow-Up Items — Post Known-Limitations Cleanup

> **Source:** Surfaced during implementation and Sentinel code review of `2026-03-13-known-limitations-cleanup.md`.
> **Priority:** Low — none are blockers. All are type-safety or doc-alignment improvements.
> **Estimated effort:** ~1-2 hours total

---

## FU-1: Align `RelentlessConfig` interface with `defaults.jsonc`

**Priority:** LOW
**Source:** Sentinel review W-1, N-4
**Impact:** Type safety — prevents unsafe casts and ensures IDE autocompletion for all config keys.

### Problem

`RelentlessConfig` in `lib/config.ts:45-52` only declares 6 of 11 config sections that exist in `defaults.jsonc`. The runtime object carries all keys (via `deepMerge`), but TypeScript doesn't know about the missing 5.

**Currently typed:**
| Key | Interface |
|-----|-----------|
| `categories` | `CategoriesConfig` |
| `circuit_breaker` | `CircuitBreakerConfig` |
| `pursuit` | `PursuitConfig` |
| `recon` | `ReconConfig` |
| `templates` | `TemplatesConfig` |
| `branching` | `BranchingConfig` |

**Missing from type (present in `defaults.jsonc` and used at runtime):**
| Key | Used By |
|-----|---------|
| `lessons` | `lib/state.ts:140` (via unsafe cast), plugin `relentless.ts` |
| `routing` | `lib/routing.ts` |
| `doc_tracker` | `lib/doc-tracker.ts` |
| `time_budget` | plugin `relentless.ts` |
| `chunk_gate` | pursuit loop / chunk-gate skill |

### Symptom

`lib/state.ts:140` required this workaround to access `lessons.share_globally`:
```typescript
const lessonsConfig = (config as unknown as Record<string, Record<string, unknown>>).lessons;
```

### Fix

- [ ] **Step 1:** Add 5 new interfaces to `lib/config.ts`:

  ```typescript
  interface LessonsConfig {
    enabled: boolean;
    max_lessons_in_context: number;
    max_lessons_in_handoff: number;
    share_globally: boolean;
  }

  interface RoutingConfig {
    learning_enabled: boolean;
    min_data_points: number;
  }

  interface DocTrackerPattern {
    glob: string;
    docs: string[];
  }

  interface DocTrackerConfig {
    enabled: boolean;
    patterns: DocTrackerPattern[];
  }

  interface TimeBudgetConfig {
    target_feature_ratio: number;
    max_fix_ratio: number;
    consecutive_fix_alert: number;
  }

  interface ChunkGateConfig {
    enabled: boolean;
    gate_commands: string[];
  }
  ```

- [ ] **Step 2:** Add 5 fields to `RelentlessConfig`:

  ```typescript
  export interface RelentlessConfig {
    categories: CategoriesConfig;
    circuit_breaker: CircuitBreakerConfig;
    pursuit: PursuitConfig;
    recon: ReconConfig;
    templates: TemplatesConfig;
    branching: BranchingConfig;
    lessons: LessonsConfig;          // NEW
    routing: RoutingConfig;          // NEW
    doc_tracker: DocTrackerConfig;   // NEW
    time_budget: TimeBudgetConfig;   // NEW
    chunk_gate: ChunkGateConfig;     // NEW
  }
  ```

- [ ] **Step 3:** Add defaults for all 5 in `loadConfig()` defaults object (matching `defaults.jsonc`)

- [ ] **Step 4:** Remove the unsafe cast in `lib/state.ts:140`:

  ```typescript
  // Before:
  const lessonsConfig = (config as unknown as Record<string, Record<string, unknown>>).lessons;
  if (lessonsConfig?.share_globally) {

  // After:
  if (config.lessons.share_globally) {
  ```

- [ ] **Step 5:** Run `npm run build && npm test` to verify

### Files:
| File | Action |
|------|--------|
| `lib/config.ts` | Modify — add interfaces, extend `RelentlessConfig`, add defaults |
| `lib/state.ts` | Modify — remove unsafe cast on line 140 |
| `lib/config.test.ts` | Modify — add test verifying new config keys have correct defaults |

### Acceptance Gate
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] No `as unknown as Record<string, ...>` casts remain for config access
- [ ] `loadConfig()` returns object with all 11 config sections typed
- [ ] IDE autocompletion works for `config.lessons.share_globally`

---

## FU-2: Add status validation to `mergeBranch()` and `abandonBranch()`

**Priority:** LOW
**Source:** Sentinel review N-6
**Impact:** Doc-code alignment — command docs promise validation that the code doesn't enforce.

### Problem

`commands/merge.md` and `commands/abandon.md` both say:
> "Validates the branch exists and is in `active` or `paused` status"

But `mergeBranch()` and `abandonBranch()` in `lib/branching.ts:178-194` only check that the branch exists (via `updateBranch()` helper at line 62-79). They don't check status — meaning you can merge an already-abandoned branch or abandon an already-merged branch.

### Current Code

```typescript
// lib/branching.ts:178
export function mergeBranch(projectDir: string | undefined, branchId: string): PursuitBranch {
  return updateBranch(projectDir, branchId, (branch, registry) => {
    branch.status = "merged";
    // ...
  });
}

// lib/branching.ts:62 (updateBranch helper)
function updateBranch(...) {
  const registry = readBranchRegistry(projectDir);
  const index = registry.branches.findIndex((branch) => branch.id === branchId);
  if (index === -1) {
    throw new Error(`Branch not found: ${branchId}`);  // Only checks existence
  }
  // ...
}
```

Note: `switchBranch()` (line 158-159) already has the correct validation pattern:
```typescript
if (target.status === "merged" || target.status === "abandoned") {
  throw new Error(`Cannot switch to ${target.status} branch: ${branchId}`);
}
```

### Fix

- [ ] **Step 1:** Write failing tests in `lib/branching.test.ts`:

  ```typescript
  // Merging an already-merged branch should throw
  assert.throws(
    () => mergeBranch(dir, alreadyMergedBranchId),
    /Cannot merge.*merged/,
  );

  // Merging an abandoned branch should throw
  assert.throws(
    () => mergeBranch(dir, abandonedBranchId),
    /Cannot merge.*abandoned/,
  );

  // Abandoning an already-abandoned branch should throw
  assert.throws(
    () => abandonBranch(dir, alreadyAbandonedBranchId),
    /Cannot abandon.*abandoned/,
  );

  // Abandoning a merged branch should throw
  assert.throws(
    () => abandonBranch(dir, mergedBranchId),
    /Cannot abandon.*merged/,
  );
  ```

- [ ] **Step 2:** Run tests to verify they fail

- [ ] **Step 3:** Add status guards in `mergeBranch()` and `abandonBranch()`:

  ```typescript
  export function mergeBranch(projectDir: string | undefined, branchId: string): PursuitBranch {
    return updateBranch(projectDir, branchId, (branch) => {
      if (branch.status === "merged" || branch.status === "abandoned") {
        throw new Error(`Cannot merge ${branch.status} branch: ${branchId}`);
      }
      branch.status = "merged";
      // ...
    });
  }
  ```

  Same pattern for `abandonBranch()`.

- [ ] **Step 4:** Run `npm run build && npm test` to verify

### Files:
| File | Action |
|------|--------|
| `lib/branching.ts` | Modify — add status guards |
| `lib/branching.test.ts` | Modify — add tests for invalid status transitions |

### Acceptance Gate
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] `mergeBranch()` throws on merged/abandoned branches
- [ ] `abandonBranch()` throws on merged/abandoned branches
- [ ] `mergeBranch()` still works on active/paused branches
- [ ] `abandonBranch()` still works on active/paused branches
- [ ] Command docs now match code behavior

---

## FU-3: Add edge case tests for `parseJsonc` (advisory)

**Priority:** LOW
**Source:** Sentinel review N-1, N-2, N-5
**Impact:** Test coverage — error messages could be more informative, but behavior is correct.

### Problem

Three edge cases in `lib/jsonc.ts` produce correct outcomes (throws an error) but with unhelpful error messages:

1. **Unterminated block comment:** `{/* unterminated` → throws `SyntaxError` from `JSON.parse` instead of "unterminated block comment"
2. **Unterminated string:** `{"key": "val` → throws `SyntaxError` from `JSON.parse` instead of "unterminated string"
3. **Empty string input:** `""` → throws `Unexpected end of JSON input`

All three throw errors (correct behavior), but the error messages come from `JSON.parse` rather than describing the JSONC-specific issue. For a config parser used on controlled files, this is acceptable but could be improved.

### Fix (optional)

- [ ] Add tests documenting current behavior:

  ```typescript
  // Unterminated block comment throws
  assert.throws(() => parseJsonc('{/* unterminated'), /./);

  // Unterminated string throws
  assert.throws(() => parseJsonc('{"key": "val'), /./);

  // Empty string throws
  assert.throws(() => parseJsonc(''), /./);
  ```

- [ ] Optionally, add pre-validation in `stripComments()` to detect unterminated block comments and throw a descriptive error:

  ```typescript
  // After the while loop in stripComments:
  if (/* block comment was started but never closed */) {
    throw new SyntaxError("Unterminated block comment in JSONC input");
  }
  ```

### Files:
| File | Action |
|------|--------|
| `lib/jsonc.ts` | Modify (optional) — add unterminated comment detection |
| `lib/jsonc.test.ts` | Modify — add edge case tests |

### Acceptance Gate
- [ ] `npm run build` passes
- [ ] `npm test` passes
- [ ] Edge cases throw descriptive errors (if pre-validation added)

---

## Previously Deferred (from cleanup plan, unchanged)

These items were already documented as deferred in `2026-03-13-known-limitations-cleanup.md` and remain unchanged:

| ID | Item | Reason |
|----|------|--------|
| KL-S3-2 | `updateActualCost()` per-dispatch tracking | Requires plugin SDK changes not yet available |
| KL-S2-5 | Health/recovery runtime extraction | Consistent with skill-based architecture, low ROI |
| KL-S3-4 | `recordDispatch()` todo naming fragility | Lower risk than initially documented — `PursuitTodo.agent` field exists |

---

## Execution Order

```
FU-1 (RelentlessConfig alignment)   [~45 min]  ← highest value, removes tech debt
    ↓
FU-2 (branch status validation)     [~20 min]  ← small, focused
    ↓
FU-3 (parseJsonc edge case tests)   [~15 min]  ← optional, advisory
```

FU-1 and FU-2 are independent (no shared files). Can be parallelized.
FU-3 is independent of both.
