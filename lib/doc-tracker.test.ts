import assert from "assert";
import { existsSync, mkdirSync, rmSync } from "fs";
import { join } from "path";
import {
  clearDocTracking,
  formatDirtyDocsReport,
  getDirtyDocsByFile,
  isDirtyDoc,
  markDocDirty,
  markDocsDirty,
  matchesGlob,
  readAllDocEntries,
  readDirtyDocs,
  resolveDoc,
} from "./doc-tracker.js";

const TEST_DIR = "/tmp/relentless-doc-tracker-test-" + Date.now();
mkdirSync(TEST_DIR, { recursive: true });

assert.deepStrictEqual(readDirtyDocs(TEST_DIR), [], "readDirtyDocs should return empty array when file is missing");
console.log("PASS: readDirtyDocs returns empty array when no file");

const singleEntry = markDocDirty(
  TEST_DIR,
  "README.md",
  "lib/doc-tracker.ts was modified",
  "lib/doc-tracker.ts",
  "artisan"
);
assert.strictEqual(singleEntry.docFile, "README.md", "markDocDirty should set docFile");
assert.strictEqual(singleEntry.status, "dirty", "markDocDirty should create dirty status");
const dirtyAfterSingle = readDirtyDocs(TEST_DIR);
assert.strictEqual(dirtyAfterSingle.length, 1, "readDirtyDocs should include newly marked entry");
assert.strictEqual(dirtyAfterSingle[0].reason, "lib/doc-tracker.ts was modified", "entry should preserve reason");
console.log("PASS: markDocDirty creates entry and readDirtyDocs returns it");

const defaultPatternEntries = markDocsDirty(TEST_DIR, "lib/state.ts", "artisan");
assert.strictEqual(defaultPatternEntries.length, 1, "markDocsDirty should only add unresolved docs that are not already dirty");
assert.strictEqual(defaultPatternEntries[0].docFile, "lib/AGENTS.md", "markDocsDirty should match default lib pattern");
const dirtyAfterDefault = readDirtyDocs(TEST_DIR);
assert.strictEqual(dirtyAfterDefault.some((entry) => entry.docFile === "lib/AGENTS.md"), true, "dirty docs should include lib/AGENTS.md");
assert.strictEqual(dirtyAfterDefault.some((entry) => entry.docFile === "README.md"), true, "dirty docs should include existing README.md entry");
console.log("PASS: markDocsDirty with default patterns creates matching entries");

const duplicateOne = markDocDirty(TEST_DIR, "docs/AGENTS.md", "first reason", "commands/run.ts", "artisan");
const duplicateTwo = markDocDirty(TEST_DIR, "docs/AGENTS.md", "second reason", "commands/run.ts", "artisan");
assert.strictEqual(duplicateOne.docFile, duplicateTwo.docFile, "markDocDirty should return same doc file");
const allEntriesAfterDup = readAllDocEntries(TEST_DIR);
assert.strictEqual(
  allEntriesAfterDup.filter((entry) => entry.docFile === "docs/AGENTS.md" && entry.status === "dirty").length,
  1,
  "marking same doc dirty twice should not create duplicates"
);
console.log("PASS: deduplication prevents duplicate dirty entries");

const resolved = resolveDoc(TEST_DIR, "README.md", "artisan");
assert.strictEqual(resolved, true, "resolveDoc should return true when doc exists");
const dirtyAfterResolve = readDirtyDocs(TEST_DIR);
assert.strictEqual(dirtyAfterResolve.some((entry) => entry.docFile === "README.md"), false, "resolved doc should be removed from dirty list");
console.log("PASS: resolveDoc marks entry resolved and removes from dirty docs");

assert.strictEqual(resolveDoc(TEST_DIR, "not-found.md", "artisan"), false, "resolveDoc should return false for non-existent doc");
console.log("PASS: resolveDoc returns false for non-existent doc");

const allEntries = readAllDocEntries(TEST_DIR);
assert.strictEqual(allEntries.some((entry) => entry.status === "dirty"), true, "readAllDocEntries should include dirty entries");
assert.strictEqual(allEntries.some((entry) => entry.status === "resolved"), true, "readAllDocEntries should include resolved entries");
console.log("PASS: readAllDocEntries returns dirty and resolved entries");

const emptyReportDir = "/tmp/relentless-doc-tracker-empty-" + Date.now();
mkdirSync(emptyReportDir, { recursive: true });
assert.strictEqual(
  formatDirtyDocsReport(emptyReportDir),
  "No dirty documentation entries.",
  "formatDirtyDocsReport should return empty message when no dirty docs"
);
console.log("PASS: formatDirtyDocsReport returns empty message when no dirty docs");

markDocDirty(TEST_DIR, "skills/AGENTS.md", "skills/intent-gate/SKILL.md changed", "skills/intent-gate/SKILL.md", "artisan");
const report = formatDirtyDocsReport(TEST_DIR);
assert.strictEqual(report.includes("Dirty Documentation Report"), true, "report should include heading");
assert.strictEqual(report.includes("skills/AGENTS.md"), true, "report should include dirty doc path");
assert.strictEqual(report.includes("skills/intent-gate/SKILL.md changed"), true, "report should include reason");
console.log("PASS: formatDirtyDocsReport returns formatted report with dirty docs");

// isDirtyDoc tests
assert.strictEqual(isDirtyDoc(TEST_DIR, "skills/AGENTS.md"), true, "isDirtyDoc should return true for dirty doc");
assert.strictEqual(isDirtyDoc(TEST_DIR, "nonexistent.md"), false, "isDirtyDoc should return false for unknown doc");
// README.md was resolved earlier in the test, so it should not be dirty
assert.strictEqual(isDirtyDoc(TEST_DIR, "README.md"), false, "isDirtyDoc should return false for resolved doc");
console.log("PASS: isDirtyDoc checks specific doc dirty status");

// getDirtyDocsByFile tests
const filteredDirty = getDirtyDocsByFile(TEST_DIR, ["skills/AGENTS.md", "lib/AGENTS.md", "nonexistent.md"]);
assert.ok(filteredDirty.length > 0, "getDirtyDocsByFile should return matching entries");
assert.ok(filteredDirty.every((e) => e.status === "dirty"), "getDirtyDocsByFile should only return dirty entries");
assert.ok(filteredDirty.some((e) => e.docFile === "skills/AGENTS.md"), "getDirtyDocsByFile should include skills/AGENTS.md");
assert.ok(filteredDirty.some((e) => e.docFile === "lib/AGENTS.md"), "getDirtyDocsByFile should include lib/AGENTS.md");
assert.ok(!filteredDirty.some((e) => e.docFile === "nonexistent.md"), "getDirtyDocsByFile should not include nonexistent files");
console.log("PASS: getDirtyDocsByFile filters by specific doc files");

clearDocTracking(TEST_DIR);
assert.deepStrictEqual(readAllDocEntries(TEST_DIR), [], "clearDocTracking should remove all entries");
assert.strictEqual(existsSync(join(TEST_DIR, ".relentless", "shared-context", "doc-dirty.jsonl")), false, "clearDocTracking should remove tracking file");
console.log("PASS: clearDocTracking removes all doc tracking entries");

assert.strictEqual(matchesGlob("lib/doc-tracker.ts", "lib/**/*.ts"), true, "lib/**/*.ts should match lib file");
assert.strictEqual(matchesGlob("lib/nested/doc-tracker.ts", "lib/**/*.ts"), true, "lib/**/*.ts should match nested lib file");
assert.strictEqual(matchesGlob("skills/foo/SKILL.md", "skills/**/*"), true, "skills/**/* should match nested skills file");
assert.strictEqual(matchesGlob("agents/architect.md", "skills/**/*"), false, "skills/**/* should not match non-skills file");
assert.strictEqual(matchesGlob("commands/unleash.ts", "**/*"), true, "**/* should match any file");
console.log("PASS: matchesGlob handles supported glob patterns");

rmSync(TEST_DIR, { recursive: true, force: true });
rmSync(emptyReportDir, { recursive: true, force: true });
console.log("All doc tracker tests passed.");
