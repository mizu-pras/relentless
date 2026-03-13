import {
  readPursuitState,
  writePursuitState,
  isHalted,
  setHalt,
  clearHalt,
  formatStatus,
  archiveCompleted,
  readAssignments,
  writeAssignments,
  isFileAssigned,
  assignFiles,
  releaseFiles,
} from "./state.js";
import { mkdirSync, rmSync, existsSync, writeFileSync, readFileSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import assert from "assert";

const TEST_DIR = "/tmp/relentless-test-" + Date.now();
mkdirSync(TEST_DIR, { recursive: true });

assert.strictEqual(readPursuitState(TEST_DIR), null, "should return null when no state file");
console.log("PASS: readPursuitState returns null when no file");

const state = { task: "test task", todos: [], current_loop: 1, max_loops: 10 };
writePursuitState(TEST_DIR, state);
const read = readPursuitState(TEST_DIR);
assert.ok(read, "should read state after writing");
assert.strictEqual(read.task, "test task", "should read back task");
assert.ok(read.updated_at, "should have updated_at timestamp");
assert.strictEqual(read.version, 1, "should have version 1");
console.log("PASS: writePursuitState and readPursuitState round-trip");

assert.strictEqual(isHalted(TEST_DIR), false, "should not be halted initially");
setHalt(TEST_DIR, "test halt");
assert.strictEqual(isHalted(TEST_DIR), true, "should be halted after setHalt");
console.log("PASS: halt flag set/check");

clearHalt(TEST_DIR);
assert.strictEqual(isHalted(TEST_DIR), false, "should not be halted after clearHalt");
console.log("PASS: clearHalt removes halt flag");

const nullStatus = formatStatus(null);
assert.ok(nullStatus.includes("No active pursuit"), "null state should show no active pursuit");
console.log("PASS: formatStatus handles null state");

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

const archivedPath = archiveCompleted(TEST_DIR);
assert.ok(archivedPath, "should return archive path when pursuit exists");
assert.strictEqual(existsSync(join(TEST_DIR, ".relentless", "current-pursuit.json")), false, "should remove current pursuit file");
assert.strictEqual(existsSync(archivedPath), true, "should create archive file in history");
assert.ok(archivedPath.includes(join(TEST_DIR, ".relentless", "history")), "archive should be written to history dir");
console.log("PASS: archiveCompleted archives and removes current pursuit");

assert.deepStrictEqual(readAssignments(TEST_DIR), [], "assignments should be empty initially");
writeAssignments(TEST_DIR, [
  {
    agent: "artisan",
    files: ["lib/state.ts", "lib/state.test.ts"],
    task_id: "T-007",
    assigned_at: "2026-03-12T00:00:00.000Z",
  },
]);
const assignments = readAssignments(TEST_DIR);
assert.strictEqual(assignments.length, 1, "should read back written assignments");
assert.strictEqual(assignments[0].agent, "artisan", "should preserve agent field");
assert.ok(isFileAssigned(TEST_DIR, "lib/state.ts"), "should report assigned file owner");
assert.strictEqual(isFileAssigned(TEST_DIR, "lib/other.ts"), null, "should return null for unassigned file");
assignFiles(TEST_DIR, "sentinel", ["lib/circuit-breaker.ts"], "T-008");
assert.ok(isFileAssigned(TEST_DIR, "lib/circuit-breaker.ts"), "assignFiles should persist new assignments");
releaseFiles(TEST_DIR, "artisan");
assert.strictEqual(isFileAssigned(TEST_DIR, "lib/state.ts"), null, "releaseFiles should remove assignments for agent");
assert.ok(isFileAssigned(TEST_DIR, "lib/circuit-breaker.ts"), "releaseFiles should keep other agent assignments");
console.log("PASS: agent assignment read/write/check/assign/release");

const globalLessonsPath = join(homedir(), ".config", "opencode", "relentless", "global-lessons.jsonl");
const globalLessonsExisted = existsSync(globalLessonsPath);
const globalLessonsBackup = globalLessonsExisted ? readFileSync(globalLessonsPath, "utf8") : "";

const shareTrueDir = join(TEST_DIR, "share-true");
mkdirSync(join(shareTrueDir, ".opencode"), { recursive: true });
writePursuitState(shareTrueDir, { task: "promote true", todos: [], current_loop: 1, max_loops: 1 });
writeFileSync(
  join(shareTrueDir, ".relentless", "lessons.jsonl"),
  `${JSON.stringify({
    id: "L-promote-true",
    category: "type_error",
    pattern: "Type mismatch in API payload",
    resolution: "Normalize payload type before call",
    frequency: 3,
    agents: ["artisan"],
    examples: ["Type error in handler"],
    first_seen: "2026-03-13T00:00:00.000Z",
    last_seen: "2026-03-13T00:00:00.000Z",
    source_files: ["src/api.ts", "src/service.ts"],
  })}\n`,
  "utf8",
);
writeFileSync(join(shareTrueDir, ".opencode", "relentless.jsonc"), `{"lessons":{"share_globally":true}}`, "utf8");
const promotedArchivePath = archiveCompleted(shareTrueDir);
assert.ok(promotedArchivePath, "archive should succeed when share_globally is enabled");
assert.strictEqual(existsSync(globalLessonsPath), true, "should create global lessons store when share_globally is true");
const promotedGlobalContent = readFileSync(globalLessonsPath, "utf8");
assert.ok(promotedGlobalContent.includes('"id":"L-promote-true"'), "should promote qualifying lesson to global store");
console.log("PASS: archiveCompleted promotes lessons globally when enabled");

const shareFalseDir = join(TEST_DIR, "share-false");
mkdirSync(shareFalseDir, { recursive: true });
writePursuitState(shareFalseDir, { task: "promote false", todos: [], current_loop: 1, max_loops: 1 });
writeFileSync(
  join(shareFalseDir, ".relentless", "lessons.jsonl"),
  `${JSON.stringify({
    id: "L-promote-false",
    category: "type_error",
    pattern: "Type mismatch in API payload",
    resolution: "Normalize payload type before call",
    frequency: 3,
    agents: ["artisan"],
    examples: ["Type error in handler"],
    first_seen: "2026-03-13T00:00:00.000Z",
    last_seen: "2026-03-13T00:00:00.000Z",
    source_files: ["src/api.ts", "src/service.ts"],
  })}\n`,
  "utf8",
);
const globalBeforeShareFalse = existsSync(globalLessonsPath) ? readFileSync(globalLessonsPath, "utf8") : "";
const notPromotedArchivePath = archiveCompleted(shareFalseDir);
assert.ok(notPromotedArchivePath, "archive should succeed when share_globally is disabled");
const globalAfterShareFalse = existsSync(globalLessonsPath) ? readFileSync(globalLessonsPath, "utf8") : "";
assert.strictEqual(globalAfterShareFalse, globalBeforeShareFalse, "should not change global lessons store by default");
console.log("PASS: archiveCompleted does not promote lessons globally by default");

const shareFailureDir = join(TEST_DIR, "share-failure");
mkdirSync(join(shareFailureDir, ".opencode"), { recursive: true });
writePursuitState(shareFailureDir, { task: "promote failure", todos: [], current_loop: 1, max_loops: 1 });
writeFileSync(
  join(shareFailureDir, ".relentless", "lessons.jsonl"),
  `${JSON.stringify({
    id: "L-promote-failure",
    category: "type_error",
    pattern: "Type mismatch in API payload",
    resolution: "Normalize payload type before call",
    frequency: 3,
    agents: ["artisan"],
    examples: ["Type error in handler"],
    first_seen: "2026-03-13T00:00:00.000Z",
    last_seen: "2026-03-13T00:00:00.000Z",
    source_files: ["src/api.ts", "src/service.ts"],
  })}\n`,
  "utf8",
);
writeFileSync(join(shareFailureDir, ".opencode", "relentless.jsonc"), `{"lessons":{"share_globally":true}}`, "utf8");
if (existsSync(globalLessonsPath)) {
  rmSync(globalLessonsPath, { recursive: true, force: true });
}
mkdirSync(globalLessonsPath, { recursive: true });
const failureArchivePath = archiveCompleted(shareFailureDir);
assert.ok(failureArchivePath, "archive should still succeed even if lesson promotion fails");
assert.strictEqual(
  existsSync(join(shareFailureDir, ".relentless", "current-pursuit.json")),
  false,
  "archive should still remove current pursuit when promotion fails",
);
console.log("PASS: archiveCompleted gracefully degrades when promotion fails");

rmSync(globalLessonsPath, { recursive: true, force: true });
if (globalLessonsExisted) {
  writeFileSync(globalLessonsPath, globalLessonsBackup, "utf8");
} else if (existsSync(globalLessonsPath)) {
  unlinkSync(globalLessonsPath);
}

rmSync(TEST_DIR, { recursive: true });
console.log("All state tests passed.");
