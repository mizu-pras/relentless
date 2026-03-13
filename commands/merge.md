---
name: merge
description: Merge a successful pursuit branch back into main pursuit
---

# /merge

## Usage
```
/merge <branch-id>
```

## Behavior
1. Validates the branch exists and is in `active` or `paused` status
2. Marks the branch as merged in the branch registry
3. Cleans up the git worktree if applicable
4. Restores the main pursuit state
