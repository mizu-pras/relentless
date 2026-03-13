---
name: abandon
description: Abandon a pursuit branch and clean up its resources
---

# /abandon

## Usage
```
/abandon <branch-id>
```

## Behavior
1. Validates the branch exists and is in `active` or `paused` status
2. Requires confirmation before proceeding
3. Marks the branch as abandoned in the branch registry
4. Removes the git worktree and cleans up resources
5. Preserves any lessons learned during the branch's pursuit
