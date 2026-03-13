import assert from "assert";
import { mkdtempSync, rmSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import {
  abandonBranch,
  createBranch,
  formatBranchList,
  getBranch,
  listBranches,
  mergeBranch,
  readBranchRegistry,
  sanitizeBranchName,
  switchBranch,
  writeBranchRegistry,
} from "./branching.js";

const TEST_DIR = mkdtempSync(join(tmpdir(), "relentless-branching-test-"));

function withNow<T>(fixedNow: number, fn: () => T): T {
  const originalNow = Date.now;
  Date.now = () => fixedNow;
  try {
    return fn();
  } finally {
    Date.now = originalNow;
  }
}

try {
  const emptyDir = join(TEST_DIR, "empty");
  const defaultRegistry = readBranchRegistry(emptyDir);
  assert.deepStrictEqual(
    defaultRegistry,
    { branches: [], max_branches: 3 },
    "readBranchRegistry should return default registry when file is missing",
  );
  console.log("PASS: readBranchRegistry returns default empty registry");

  const roundTripDir = join(TEST_DIR, "round-trip");
  const inputRegistry = {
    branches: [
      {
        id: "branch-123",
        name: "first-branch",
        task: "First branch task",
        parent_pursuit_id: "p-1",
        git_branch: "pursuit/first-branch",
        worktree_path: "/tmp/w1",
        status: "paused" as const,
        created_at: "2026-03-12T00:00:00.000Z",
        updated_at: "2026-03-12T00:00:00.000Z",
      },
    ],
    max_branches: 5,
    active_branch: "branch-123",
  };
  writeBranchRegistry(roundTripDir, inputRegistry);
  const loadedRegistry = readBranchRegistry(roundTripDir);
  assert.deepStrictEqual(loadedRegistry, inputRegistry, "write/read should round-trip branch registry");
  console.log("PASS: writeBranchRegistry and readBranchRegistry round-trip data");

  const createDir = join(TEST_DIR, "create");
  const created = withNow(1700000000000, () => createBranch(createDir, "Explore Alternate Auth Flow", "p-123"));
  assert.strictEqual(created.id, "branch-1700000000000", "createBranch should use timestamp-based id");
  assert.strictEqual(created.name, "explore-alternate-auth-flow", "createBranch should derive a readable name");
  assert.strictEqual(created.task, "Explore Alternate Auth Flow", "createBranch should persist original task");
  assert.strictEqual(created.parent_pursuit_id, "p-123", "createBranch should persist parent pursuit id");
  assert.strictEqual(created.git_branch, "pursuit/explore-alternate-auth-flow", "createBranch should create git branch name");
  assert.strictEqual(
    created.worktree_path,
    join(createDir, ".worktrees", "pursuit-branch-1700000000000"),
    "createBranch should create worktree path under .worktrees",
  );
  assert.strictEqual(created.status, "active", "new branches should be active");
  assert.strictEqual(created.created_at, created.updated_at, "createBranch should set created_at and updated_at equally");
  const createdRegistry = readBranchRegistry(createDir);
  assert.strictEqual(createdRegistry.branches.length, 1, "createBranch should persist branch to registry");
  assert.strictEqual(createdRegistry.active_branch, created.id, "createBranch should set active branch");
  console.log("PASS: createBranch creates branch with expected fields");

  const sanitizeDir = join(TEST_DIR, "sanitize");
  const createdSanitized = withNow(1700000000100, () => createBranch(sanitizeDir, "Fix !!! multiple    spaces ###"));
  assert.strictEqual(
    createdSanitized.git_branch,
    "pursuit/fix-multiple-spaces",
    "createBranch should generate git-safe branch names",
  );
  console.log("PASS: createBranch generates git-safe branch names");

  const maxDir = join(TEST_DIR, "max");
  writeBranchRegistry(maxDir, {
    branches: [
      {
        id: "branch-a",
        name: "a",
        task: "A",
        git_branch: "pursuit/a",
        worktree_path: "/tmp/a",
        status: "active",
        created_at: "2026-03-12T00:00:00.000Z",
        updated_at: "2026-03-12T00:00:00.000Z",
      },
      {
        id: "branch-b",
        name: "b",
        task: "B",
        git_branch: "pursuit/b",
        worktree_path: "/tmp/b",
        status: "paused",
        created_at: "2026-03-12T00:00:00.000Z",
        updated_at: "2026-03-12T00:00:00.000Z",
      },
      {
        id: "branch-c",
        name: "c",
        task: "C",
        git_branch: "pursuit/c",
        worktree_path: "/tmp/c",
        status: "active",
        created_at: "2026-03-12T00:00:00.000Z",
        updated_at: "2026-03-12T00:00:00.000Z",
      },
    ],
    max_branches: 3,
  });
  assert.throws(() => createBranch(maxDir, "Should fail"), /Maximum number of active pursuit branches exceeded/);
  console.log("PASS: createBranch throws when max active branches exceeded");

  const listDir = join(TEST_DIR, "list");
  writeBranchRegistry(listDir, {
    branches: [
      {
        id: "branch-1",
        name: "one",
        task: "Task one",
        git_branch: "pursuit/one",
        worktree_path: "/tmp/one",
        status: "active",
        created_at: "2026-03-12T00:00:00.000Z",
        updated_at: "2026-03-12T00:00:00.000Z",
      },
      {
        id: "branch-2",
        name: "two",
        task: "Task two",
        git_branch: "pursuit/two",
        worktree_path: "/tmp/two",
        status: "paused",
        created_at: "2026-03-12T00:00:00.000Z",
        updated_at: "2026-03-12T00:00:00.000Z",
      },
    ],
    max_branches: 3,
    active_branch: "branch-1",
  });
  const listed = listBranches(listDir);
  assert.strictEqual(listed.length, 2, "listBranches should return all branches");
  assert.strictEqual(listed[0].id, "branch-1", "listBranches should preserve insertion order");
  console.log("PASS: listBranches returns all branches");

  assert.strictEqual(getBranch(listDir, "branch-2")?.name, "two", "getBranch should return branch by id");
  assert.strictEqual(getBranch(listDir, "missing"), null, "getBranch should return null for missing id");
  console.log("PASS: getBranch resolves by id or null");

  const switched = switchBranch(listDir, "branch-2");
  assert.strictEqual(switched.id, "branch-2", "switchBranch should return switched branch");
  const switchedRegistry = readBranchRegistry(listDir);
  assert.strictEqual(switchedRegistry.active_branch, "branch-2", "switchBranch should update active branch id");
  assert.strictEqual(getBranch(listDir, "branch-1")?.status, "paused", "switchBranch should pause previous active branch");
  assert.strictEqual(getBranch(listDir, "branch-2")?.status, "active", "switchBranch should activate selected branch");
  console.log("PASS: switchBranch updates active branch and statuses");

  assert.throws(() => switchBranch(listDir, "nope"), /Branch not found/);
  console.log("PASS: switchBranch throws for non-existent branch");

  const merged = mergeBranch(listDir, "branch-1");
  assert.strictEqual(merged.status, "merged", "mergeBranch should set branch status to merged");
  console.log("PASS: mergeBranch marks branch as merged");

  const abandoned = abandonBranch(listDir, "branch-2");
  assert.strictEqual(abandoned.status, "abandoned", "abandonBranch should set branch status to abandoned");
  const abandonedRegistry = readBranchRegistry(listDir);
  assert.strictEqual(abandonedRegistry.active_branch, undefined, "abandoning active branch should clear active_branch");
  console.log("PASS: abandonBranch marks branch as abandoned and clears active branch");

  assert.strictEqual(
    sanitizeBranchName(" Feature: Add @@@ Branching Support!!! "),
    "feature-add-branching-support",
    "sanitizeBranchName should normalize special characters",
  );
  assert.strictEqual(sanitizeBranchName(""), "untitled", "sanitizeBranchName should fallback for empty strings");
  assert.strictEqual(
    sanitizeBranchName("A".repeat(60)).length,
    50,
    "sanitizeBranchName should cap output length at 50 chars",
  );
  console.log("PASS: sanitizeBranchName handles special, empty, and long strings");

  const formatted = formatBranchList(
    [
      {
        id: "branch-123",
        name: "my-task",
        task: "Do something",
        git_branch: "pursuit/my-task",
        worktree_path: "/tmp/a",
        status: "active",
        created_at: "2026-03-12T10:11:12.000Z",
        updated_at: "2026-03-12T10:11:12.000Z",
      },
      {
        id: "branch-124",
        name: "other-task",
        task: "Do other thing",
        git_branch: "pursuit/other-task",
        worktree_path: "/tmp/b",
        status: "paused",
        created_at: "2026-03-12T12:00:00.000Z",
        updated_at: "2026-03-12T12:00:00.000Z",
      },
    ],
    "branch-123",
  );
  assert.strictEqual(formatted.includes("## Pursuit Branches"), true, "format should include heading");
  assert.strictEqual(formatted.includes("| branch-123 | * my-task | active | Do something | 2026-03-12 |"), true);
  assert.strictEqual(formatted.includes("Active: branch-123"), true, "format should include active branch id");
  assert.strictEqual(formatted.includes("Total: 2/3 (1 slot available)"), true, "format should include default slot summary");
  console.log("PASS: formatBranchList formats rows and active marker");

  const emptyFormatted = formatBranchList([], undefined);
  assert.strictEqual(emptyFormatted.includes("| (none) |"), true, "format should show empty-row placeholder");
  assert.strictEqual(emptyFormatted.includes("Active: (none)"), true, "format should show no active branch");
  assert.strictEqual(emptyFormatted.includes("Total: 0/3 (3 slots available)"), true, "format should show capacity for empty list");
  console.log("PASS: formatBranchList handles empty branch list");

  const customMaxFormatted = formatBranchList(
    [
      {
        id: "branch-123",
        name: "my-task",
        task: "Do something",
        git_branch: "pursuit/my-task",
        worktree_path: "/tmp/a",
        status: "active",
        created_at: "2026-03-12T10:11:12.000Z",
        updated_at: "2026-03-12T10:11:12.000Z",
      },
    ],
    "branch-123",
    5,
  );
  assert.strictEqual(
    customMaxFormatted.includes("Total: 1/5 (4 slots available)"),
    true,
    "formatBranchList should respect custom maxBranches",
  );
  console.log("PASS: formatBranchList respects custom maxBranches parameter");

  const defaultMaxFormatted = formatBranchList(
    [
      {
        id: "branch-456",
        name: "other-task",
        task: "Other thing",
        git_branch: "pursuit/other-task",
        worktree_path: "/tmp/b",
        status: "active",
        created_at: "2026-03-12T10:11:12.000Z",
        updated_at: "2026-03-12T10:11:12.000Z",
      },
    ],
    "branch-456",
  );
  assert.strictEqual(
    defaultMaxFormatted.includes("Total: 1/3 (2 slots available)"),
    true,
    "formatBranchList should default to 3 when maxBranches omitted",
  );
  console.log("PASS: formatBranchList defaults to 3 when maxBranches omitted");

  console.log("All branching tests passed.");
} finally {
  rmSync(TEST_DIR, { recursive: true, force: true });
}
