import { readPursuitState, writePursuitState, isHalted, setHalt, clearHalt, formatStatus } from "./state.js";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import assert from "assert";

const TEST_DIR = "/tmp/relentless-test-" + Date.now();
mkdirSync(TEST_DIR, { recursive: true });

// Test 1: readPursuitState returns null when no file
assert.strictEqual(readPursuitState(TEST_DIR), null, "should return null when no state file");
console.log("PASS: readPursuitState returns null when no file");

// Test 2: writePursuitState then readPursuitState
const state = { task: "test task", todos: [], current_loop: 1, max_loops: 10 };
writePursuitState(TEST_DIR, state);
const read = readPursuitState(TEST_DIR);
assert.strictEqual(read.task, "test task", "should read back task");
assert.ok(read.updated_at, "should have updated_at timestamp");
assert.strictEqual(read.version, 1, "should have version 1");
console.log("PASS: writePursuitState and readPursuitState round-trip");

// Test 3: halt flag
assert.strictEqual(isHalted(TEST_DIR), false, "should not be halted initially");
setHalt(TEST_DIR, "test halt");
assert.strictEqual(isHalted(TEST_DIR), true, "should be halted after setHalt");
console.log("PASS: halt flag set/check");

// Test 4: clearHalt
clearHalt(TEST_DIR);
assert.strictEqual(isHalted(TEST_DIR), false, "should not be halted after clearHalt");
console.log("PASS: clearHalt removes halt flag");

// Test 5: formatStatus with null
const nullStatus = formatStatus(null);
assert.ok(nullStatus.includes("No active pursuit"), "null state should show no active pursuit");
console.log("PASS: formatStatus handles null state");

// Test 6: formatStatus with state
const stateWithTodos = {
  task: "Build API",
  todos: [
    { status: "completed", id: "T-001", subject: "setup" },
    { status: "pending", id: "T-002", subject: "auth" },
  ],
  current_loop: 2,
  max_loops: 10,
  updated_at: "2026-03-11T00:00:00.000Z",
};
const status = formatStatus(stateWithTodos);
assert.ok(status.includes("50%"), "status should show 50% progress");
assert.ok(status.includes("T-002"), "status should show pending todo");
console.log("PASS: formatStatus shows correct progress");

// Cleanup
rmSync(TEST_DIR, { recursive: true });
console.log("All state tests passed.");
