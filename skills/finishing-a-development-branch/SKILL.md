---
name: finishing-a-development-branch
source: Forked from superpowers by Jesse Vincent (MIT License)
description: Use when implementation is complete, all tests pass, and you need to decide how to integrate the work - guides completion of development work by presenting structured options for merge, PR, or cleanup
---

# Finishing a Development Branch

## Overview

Guide completion of development work by presenting clear options and handling chosen workflow.

**Core principle:** Verify tests → Present options → Execute choice → Clean up.

**Relentless-specific requirements:**
- Check `.relentless/halt` before finalizing
- Archive pursuit state to `.relentless/history/` upon completion
- Clean up `.relentless/agent-assignments.json` upon completion
- Update pursuit state to mark all todos as completed

**Announce at start:** "I'm using the finishing-a-development-branch skill to complete this work."

## The Process

### Step 0: Halt Check

```bash
test -f .relentless/halt && echo "HALT present - stop immediately"
```

If halt exists, stop and report status to Conductor.

### Step 1: Verification Before Completion

**REQUIRED SUB-SKILL:** Invoke `relentless:verification-before-completion` before presenting options.

This is not just "run tests" — it is the full verification gate:

1. **Run tests** — verify exit code 0
2. **Run build** — if build step exists, verify exit code 0
3. **Check documentation** — review dirty docs report, resolve or acknowledge
4. **Requirements checklist** — re-read plan, verify each requirement is met line-by-line
5. **Evidence before claims** — every claim must have fresh command output backing it

```bash
# Run project's test suite
npm test / cargo test / pytest / go test ./...
```

**If verification fails (any step):**
```
Verification failed:
- Tests: [PASS/FAIL with evidence]
- Build: [PASS/FAIL with evidence]  
- Docs: [current/dirty with details]
- Requirements: [met/gaps with specifics]

Cannot proceed until all verification passes.
```

Stop. Don't proceed to Step 2.

**If all verification passes:** Continue to Step 2.

### Step 2: Determine Base Branch

```bash
# Try common base branches
git merge-base HEAD main 2>/dev/null || git merge-base HEAD master 2>/dev/null
```

Or ask: "This branch split from main - is that correct?"

### Step 3: Present Options

Present exactly these 4 options:

```
Implementation complete. What would you like to do?

1. Merge back to <base-branch> locally
2. Push and create a Pull Request
3. Keep the branch as-is (I'll handle it later)
4. Discard this work

Which option?
```

**Don't add explanation** - keep options concise.

### Step 4: Execute Choice

#### Option 1: Merge Locally

```bash
# Switch to base branch
git checkout <base-branch>

# Pull latest
git pull

# Merge feature branch
git merge <feature-branch>

# Verify tests on merged result
<test command>

# If tests pass
git branch -d <feature-branch>
```

Then: Cleanup worktree (Step 5)

#### Option 2: Push and Create PR

```bash
# Push branch
git push -u origin <feature-branch>

# Create PR
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
<2-3 bullets of what changed>

## Test Plan
- [ ] <verification steps>
EOF
)"
```

Then: Cleanup worktree (Step 5)

#### Option 3: Keep As-Is

Report: "Keeping branch <name>. Worktree preserved at <path>."

**Don't cleanup worktree.**

#### Option 4: Discard

**Confirm first:**
```
This will permanently delete:
- Branch <name>
- All commits: <commit-list>
- Worktree at <path>

Type 'discard' to confirm.
```

Wait for exact confirmation.

If confirmed:
```bash
git checkout <base-branch>
git branch -D <feature-branch>
```

Then: Cleanup worktree (Step 5)

### Step 5: Cleanup Worktree

**For Options 1, 2, 4:**

Check if in worktree:
```bash
git worktree list | grep $(git branch --show-current)
```

If yes:
```bash
git worktree remove <worktree-path>
```

**For Option 3:** Keep worktree.

## Quick Reference

| Option | Merge | Push | Keep Worktree | Cleanup Branch |
|--------|-------|------|---------------|----------------|
| 1. Merge locally | ✓ | - | - | ✓ |
| 2. Create PR | - | ✓ | ✓ | - |
| 3. Keep as-is | - | - | ✓ | - |
| 4. Discard | - | - | - | ✓ (force) |

## Common Mistakes

**Skipping test verification**
- **Problem:** Merge broken code, create failing PR
- **Fix:** Always verify tests before offering options

**Open-ended questions**
- **Problem:** "What should I do next?" → ambiguous
- **Fix:** Present exactly 4 structured options

**Automatic worktree cleanup**
- **Problem:** Remove worktree when might need it (Option 2, 3)
- **Fix:** Only cleanup for Options 1 and 4

**No confirmation for discard**
- **Problem:** Accidentally delete work
- **Fix:** Require typed "discard" confirmation

## Red Flags

**Never:**
- Proceed with failing tests
- Merge without verifying tests on result
- Delete work without confirmation
- Force-push without explicit request

**Always:**
- Verify tests before offering options
- Present exactly 4 options
- Get typed confirmation for Option 4
- Clean up worktree for Options 1 & 4 only

## Integration

**Called by:**
- **unleash** (Phase 7) — after pursuit loop completes and verification passes
- Pursuit loop handles task execution and then invokes this completion flow

**Required sub-skills:**
- **relentless:verification-before-completion** — REQUIRED in Step 1 before presenting options
- **using-git-worktrees** — Cleans up worktree created by that skill


### Step 6: Relentless Pursuit Cleanup

After Options 1, 2, or 4 complete:

1. **Archive pursuit state (idempotent):**
   - Call `archiveCompleted()` from `lib/state.ts`
   - This archives to `.relentless/history/`, extracts lessons from error-log, clears shared context and compaction snapshot
   - If it returns a path: archive succeeded here
   - If it returns null: check if `current-pursuit.json` still exists
     - If NOT present: pursuit was already archived by a prior step (normal in `/unleash` pipeline) — proceed
     - If present: actual archive failure — warn but continue with cleanup

2. **Clean up agent assignments:**
   - The `archiveCompleted()` function removes `current-pursuit.json`
   - Manually delete `.relentless/agent-assignments.json` if it exists:
     ```bash
     rm -f .relentless/agent-assignments.json
     ```

3. **Verify cleanup:**
   - `.relentless/current-pursuit.json` should NOT exist
   - `.relentless/history/` should contain the new archive file
   - `.relentless/agent-assignments.json` should NOT exist

Required outcomes:
- `.relentless/history/` contains archived pursuit state with lessons extracted
- `.relentless/agent-assignments.json` is removed
- `.relentless/current-pursuit.json` is removed
- Shared context is cleared for next pursuit
