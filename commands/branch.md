---
name: branch
description: Create a new pursuit branch for exploring alternative approaches
---

# /branch

## Usage
```
/branch "task description"
```

## Behavior
1. Creates a new pursuit branch in `.relentless/branches.json`
2. Sets up a git worktree using `skills/using-git-worktrees`
3. Copies current pursuit state to the new branch
4. Pauses the current pursuit (not halted - can be resumed)
5. Switches to the new branch

## Limits
- Maximum 3 concurrent branches (configurable)
- Branch names auto-sanitized for git compatibility
