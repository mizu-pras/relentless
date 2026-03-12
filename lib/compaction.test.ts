import {
  readCompactionSnapshot,
  saveCompactionSnapshot,
  formatDifferentialContext,
  CompactionSnapshot,
} from "./compaction.js";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import assert from "assert";

const TEST_DIR = join(import.meta.dirname || ".", "__test_compaction__");

function setup() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
  mkdirSync(TEST_DIR, { recursive: true });
}

function teardown() {
  if (existsSync(TEST_DIR)) rmSync(TEST_DIR, { recursive: true });
}

// Test 1: readCompactionSnapshot returns null when no file
setup();
assert.strictEqual(readCompactionSnapshot(TEST_DIR), null, "should return null when no snapshot exists");
console.log("PASS: readCompactionSnapshot returns null when no file");

// Test 2: saveCompactionSnapshot creates first snapshot
const state1 = {
  task: "Build auth module",
  current_loop: 2,
  max_loops: 10,
  todos: [
    { id: "T-001", subject: "Create login endpoint", status: "completed" },
    { id: "T-002", subject: "Create signup endpoint", status: "in_progress" },
    { id: "T-003", subject: "Add JWT validation", status: "pending" },
  ],
  circuit_breaker: { consecutive_failures: 0 },
};
const snap1 = saveCompactionSnapshot(TEST_DIR, state1);
assert.strictEqual(snap1.compaction_count, 1, "first snapshot should be count 1");
assert.strictEqual(snap1.task, "Build auth module");
assert.strictEqual(snap1.todo_statuses["T-001"], "completed");
assert.strictEqual(snap1.todo_statuses["T-002"], "in_progress");
assert.strictEqual(snap1.current_loop, 2);
console.log("PASS: saveCompactionSnapshot creates first snapshot");

// Test 3: readCompactionSnapshot reads back correctly
const readBack = readCompactionSnapshot(TEST_DIR);
assert.ok(readBack, "should read back snapshot");
assert.strictEqual(readBack!.compaction_count, 1);
assert.strictEqual(readBack!.task, "Build auth module");
console.log("PASS: readCompactionSnapshot reads back correctly");

// Test 4: second save increments count
const state2 = { ...state1, current_loop: 3 };
const snap2 = saveCompactionSnapshot(TEST_DIR, state2);
assert.strictEqual(snap2.compaction_count, 2, "second snapshot should be count 2");
console.log("PASS: second save increments compaction count");

// Test 5: formatDifferentialContext first compaction (no prev)
const ctx1 = formatDifferentialContext(state1, null);
assert.ok(ctx1.includes("Preserved Through Compaction"), "first compaction should use full format");
assert.ok(ctx1.includes("Build auth module"), "should include task");
assert.ok(ctx1.includes("T-002"), "should include pending todo");
assert.ok(ctx1.includes("Do not restart"), "should include continuation instruction");
console.log("PASS: formatDifferentialContext first compaction (full dump)");

// Test 6: formatDifferentialContext with changes
const prevSnap: CompactionSnapshot = {
  compacted_at: new Date().toISOString(),
  compaction_count: 1,
  task: "Build auth module",
  current_loop: 2,
  todo_statuses: { "T-001": "completed", "T-002": "in_progress", "T-003": "pending" },
  cb_failures: 0,
};
const state3 = {
  ...state1,
  current_loop: 3,
  todos: [
    { id: "T-001", subject: "Create login endpoint", status: "completed" },
    { id: "T-002", subject: "Create signup endpoint", status: "completed" },
    { id: "T-003", subject: "Add JWT validation", status: "in_progress" },
    { id: "T-004", subject: "Write tests", status: "pending" },
  ],
};
const ctx2 = formatDifferentialContext(state3, prevSnap);
assert.ok(ctx2.includes("State Update (Compaction #2)"), "should use differential format");
assert.ok(ctx2.includes("unchanged"), "should note task unchanged");
assert.ok(ctx2.includes("in_progress → completed"), "should show T-002 status change");
assert.ok(ctx2.includes("pending → in_progress"), "should show T-003 status change");
assert.ok(ctx2.includes("+ NEW"), "should show T-004 as new");
assert.ok(!ctx2.includes("Preserved Through Compaction"), "should NOT use first-compaction format");
console.log("PASS: formatDifferentialContext with changes");

// Test 7: formatDifferentialContext no changes
const noChangeCtx = formatDifferentialContext(state1, prevSnap);
assert.ok(noChangeCtx.includes("No todo changes"), "should note no changes");
console.log("PASS: formatDifferentialContext no changes");

// Test 8: formatDifferentialContext detects removed todos
const stateRemoved = {
  ...state1,
  todos: [
    { id: "T-001", subject: "Create login endpoint", status: "completed" },
    // T-002 and T-003 removed
  ],
};
const ctxRemoved = formatDifferentialContext(stateRemoved, prevSnap);
assert.ok(ctxRemoved.includes("REMOVED: T-002"), "should detect removed T-002");
assert.ok(ctxRemoved.includes("REMOVED: T-003"), "should detect removed T-003");
console.log("PASS: formatDifferentialContext detects removed todos");

// Test 9: formatDifferentialContext circuit breaker change
const prevWithCb: CompactionSnapshot = { ...prevSnap, cb_failures: 0 };
const stateWithCb = {
  ...state1,
  circuit_breaker: { consecutive_failures: 2 },
  config: { circuit_breaker: { max_consecutive_failures: 3 } },
};
const ctxCb = formatDifferentialContext(stateWithCb, prevWithCb);
assert.ok(ctxCb.includes("2/3 failures (was 0)"), "should show circuit breaker change");
console.log("PASS: formatDifferentialContext circuit breaker change");

// Test 10: formatDifferentialContext skips circuit breaker when unchanged
const ctxNoCb = formatDifferentialContext(state1, prevSnap);
assert.ok(!ctxNoCb.includes("Circuit breaker"), "should omit circuit breaker when unchanged");
console.log("PASS: formatDifferentialContext skips unchanged circuit breaker");

teardown();
console.log("All compaction tests passed.");
