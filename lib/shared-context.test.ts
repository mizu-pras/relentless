import {
  readMarkdownContext,
  writeMarkdownContext,
  appendDecision,
  readDecisions,
  appendError,
  readErrors,
  formatSharedContext,
  writeSummary,
  readSummary,
  readAllSummaries,
  formatSummariesForHandoff,
  getCompressionMetrics,
  resetCompressionMetrics,
  clearSharedContext,
} from "./shared-context.js";
import { markDocDirty, clearDocTracking } from "./doc-tracker.js";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import assert from "assert";

const TEST_DIR = "/tmp/relentless-shared-context-test-" + Date.now();
mkdirSync(TEST_DIR, { recursive: true });

resetCompressionMetrics();
assert.deepStrictEqual(
  getCompressionMetrics(),
  {
    total_summaries: 0,
    total_summary_chars: 0,
    handoff_requests: 0,
    summary_hits: 0,
    summary_misses: 0,
    estimated_tokens_saved: 0,
  },
  "getCompressionMetrics should return zeroed metrics initially",
);
console.log("PASS: getCompressionMetrics returns zeroed metrics initially");

assert.strictEqual(readMarkdownContext(TEST_DIR, "project-map"), "", "should return empty string when markdown file is missing");
console.log("PASS: readMarkdownContext returns empty string when no file");

const projectMap = "# Project Map\n- lib/\n- agents/";
writeMarkdownContext(TEST_DIR, "project-map", projectMap);
assert.strictEqual(readMarkdownContext(TEST_DIR, "project-map"), projectMap, "should round-trip markdown content");
console.log("PASS: writeMarkdownContext and readMarkdownContext round-trip");

assert.deepStrictEqual(readDecisions(TEST_DIR), [], "should return empty decisions array when no file");
console.log("PASS: readDecisions returns empty array when no file");

appendDecision(TEST_DIR, {
  decision: "Use JSONL for shared log channels",
  reason: "Append-only updates are simple and conflict-friendly",
  agent: "conductor",
  timestamp: "2026-03-12T00:00:00.000Z",
});
appendDecision(TEST_DIR, {
  decision: "Keep APIs synchronous",
  reason: "Matches existing state.ts helpers",
  agent: "artisan",
  timestamp: "2026-03-12T00:01:00.000Z",
});
appendDecision(TEST_DIR, {
  decision: "Store under .relentless/shared-context",
  reason: "Centralized orchestration context",
  agent: "conductor",
  timestamp: "2026-03-12T00:02:00.000Z",
});
const decisions = readDecisions(TEST_DIR);
assert.strictEqual(decisions.length, 3, "should read all appended decisions");
assert.strictEqual(decisions[0].agent, "conductor", "should preserve first decision fields");
assert.strictEqual(decisions[2].decision, "Store under .relentless/shared-context", "should preserve last decision fields");
console.log("PASS: appendDecision and readDecisions round-trip");

const recentDecisions = readDecisions(TEST_DIR, 2);
assert.strictEqual(recentDecisions.length, 2, "should return only requested number of decisions");
assert.strictEqual(recentDecisions[0].decision, "Keep APIs synchronous", "should return the last N decisions");
assert.strictEqual(recentDecisions[1].decision, "Store under .relentless/shared-context", "should include most recent decision");
console.log("PASS: readDecisions maxEntries returns last N");

assert.deepStrictEqual(readErrors(TEST_DIR), [], "should return empty errors array when no file");
console.log("PASS: readErrors returns empty array when no file");

appendError(TEST_DIR, {
  error: "Build failed in CI",
  resolution: "Aligned tsconfig module options",
  agent: "sentinel",
  file: "lib/tsconfig.json",
  timestamp: "2026-03-12T00:03:00.000Z",
});
appendError(TEST_DIR, {
  error: "Type mismatch in test fixture",
  agent: "artisan",
  file: "lib/shared-context.test.ts",
  timestamp: "2026-03-12T00:04:00.000Z",
});
const errors = readErrors(TEST_DIR);
assert.strictEqual(errors.length, 2, "should read all appended errors");
assert.strictEqual(errors[0].resolution, "Aligned tsconfig module options", "should preserve optional resolution");
assert.strictEqual(errors[1].agent, "artisan", "should preserve later error fields");
console.log("PASS: appendError and readErrors round-trip");

const emptySummaryDir = "/tmp/relentless-shared-context-empty-" + Date.now();
mkdirSync(emptySummaryDir, { recursive: true });
const emptySummary = formatSharedContext(emptySummaryDir);
assert.strictEqual(emptySummary, "", "empty summary should return empty string when all channels are empty");
console.log("PASS: formatSharedContext returns empty string when all channels empty");

writeMarkdownContext(TEST_DIR, "conventions", "- Use sync fs helpers\n- Keep tests deterministic");
const populatedSummary = formatSharedContext(TEST_DIR, 2, 1);
assert.ok(populatedSummary.includes("### Project Map"), "summary should include project map heading");
assert.ok(populatedSummary.includes("### Conventions"), "summary should include conventions heading");
assert.ok(populatedSummary.includes("Recent Decisions (last 2)"), "summary should include decisions section with limit");
assert.ok(populatedSummary.includes("Recent Errors (last 1)"), "summary should include errors section with limit");
assert.ok(populatedSummary.includes("Keep APIs synchronous"), "summary should include recent decision content");
assert.ok(populatedSummary.includes("Type mismatch in test fixture"), "summary should include recent error content");
console.log("PASS: formatSharedContext includes channels when populated");

assert.deepStrictEqual(readAllSummaries(TEST_DIR), [], "should return empty summaries when no file");
console.log("PASS: readAllSummaries returns empty array when no file");

writeSummary(TEST_DIR, {
  file: "src/auth/token.ts",
  summary: "JWT token generation and verification using jsonwebtoken lib. Has generateToken() and verifyToken().",
  agent: "scout",
  timestamp: "2026-03-12T01:00:00.000Z",
});
writeSummary(TEST_DIR, {
  file: "src/auth/middleware.ts",
  summary: "Express middleware that checks Authorization header and returns 401 on invalid token.",
  agent: "scout",
  timestamp: "2026-03-12T01:01:00.000Z",
});
const tokenSummary = readSummary(TEST_DIR, "src/auth/token.ts");
assert.ok(tokenSummary, "should find summary for written file");
assert.strictEqual(tokenSummary.summary.includes("JWT"), true, "should preserve summary content");
assert.strictEqual(readSummary(TEST_DIR, "src/nonexistent.ts"), null, "should return null for file without summary");
console.log("PASS: writeSummary and readSummary round-trip");

writeSummary(TEST_DIR, {
  file: "src/auth/token.ts",
  summary: "Updated: Now supports refresh tokens too.",
  agent: "artisan",
  timestamp: "2026-03-12T02:00:00.000Z",
});
const updatedSummary = readSummary(TEST_DIR, "src/auth/token.ts");
assert.ok(updatedSummary, "upserted summary should exist");
assert.strictEqual(updatedSummary.summary, "Updated: Now supports refresh tokens too.", "upsert should replace old summary");
assert.strictEqual(updatedSummary.agent, "artisan", "upsert should update agent");
const allSummaries = readAllSummaries(TEST_DIR);
assert.strictEqual(allSummaries.filter((s) => s.file === "src/auth/token.ts").length, 1, "upsert should not duplicate entries");
console.log("PASS: writeSummary upsert replaces existing entry");

const handoff = formatSummariesForHandoff(TEST_DIR, ["src/auth/token.ts", "src/auth/middleware.ts", "src/unknown.ts"]);
assert.ok(handoff.includes("Context Summaries"), "handoff should have heading");
assert.ok(handoff.includes("Updated: Now supports refresh tokens too"), "handoff should include known summary");
assert.ok(handoff.includes("Express middleware"), "handoff should include second known summary");
assert.ok(handoff.includes("no summary available"), "handoff should mark unknown files");
console.log("PASS: formatSummariesForHandoff formats correctly");

assert.strictEqual(formatSummariesForHandoff(TEST_DIR, []), "", "handoff with no files should return empty string");
console.log("PASS: formatSummariesForHandoff returns empty for no files");

const metricsDir = "/tmp/relentless-shared-context-metrics-" + Date.now();
mkdirSync(metricsDir, { recursive: true });
resetCompressionMetrics();
writeSummary(metricsDir, {
  file: "src/feature/gotcha.ts",
  summary: "Framework gotcha summary for route segments.",
  agent: "artisan",
  timestamp: "2026-03-12T02:15:00.000Z",
});
formatSummariesForHandoff(metricsDir, ["src/feature/gotcha.ts", "src/feature/unknown.ts"]);
assert.deepStrictEqual(
  getCompressionMetrics(),
  {
    total_summaries: 1,
    total_summary_chars: "Framework gotcha summary for route segments.".length,
    handoff_requests: 1,
    summary_hits: 1,
    summary_misses: 1,
    estimated_tokens_saved: 500,
  },
  "writeSummary and formatSummariesForHandoff should update compression metrics",
);
resetCompressionMetrics();
assert.deepStrictEqual(
  getCompressionMetrics(),
  {
    total_summaries: 0,
    total_summary_chars: 0,
    handoff_requests: 0,
    summary_hits: 0,
    summary_misses: 0,
    estimated_tokens_saved: 0,
  },
  "resetCompressionMetrics should reset all metrics to zero",
);
console.log("PASS: compression metrics update and reset correctly");

markDocDirty(TEST_DIR, "lib/AGENTS.md", "lib/shared-context.ts was modified", "lib/shared-context.ts", "artisan");
const summaryWithDirtyDocs = formatSharedContext(TEST_DIR, 2, 1);
assert.ok(summaryWithDirtyDocs.includes("Documentation Status"), "formatSharedContext should include documentation status when dirty docs exist");
assert.ok(summaryWithDirtyDocs.includes("lib/AGENTS.md"), "formatSharedContext should list dirty doc files");
console.log("PASS: formatSharedContext includes dirty docs section");

const docsOnlyDir = "/tmp/relentless-shared-context-docs-only-" + Date.now();
mkdirSync(docsOnlyDir, { recursive: true });
markDocDirty(docsOnlyDir, "README.md", "commands/unleash.ts changed", "commands/unleash.ts", "artisan");
const docsOnlySummary = formatSharedContext(docsOnlyDir);
assert.ok(docsOnlySummary.includes("Documentation Status"), "docs-only context should still include documentation status");
assert.ok(docsOnlySummary.includes("README.md"), "docs-only context should include dirty docs report");
console.log("PASS: formatSharedContext supports doc-dirty-only context");

clearDocTracking(docsOnlyDir);
assert.strictEqual(formatSharedContext(docsOnlyDir), "", "context should be empty after clearing only doc-tracking entries");
console.log("PASS: formatSharedContext returns empty after doc tracking is cleared");

clearSharedContext(TEST_DIR);
assert.strictEqual(existsSync(join(TEST_DIR, ".relentless", "shared-context")), false, "clearSharedContext should remove shared-context directory");
console.log("PASS: clearSharedContext removes shared-context directory");

assert.strictEqual(readMarkdownContext(TEST_DIR, "project-map"), "", "markdown read should reset after clear");
assert.deepStrictEqual(readDecisions(TEST_DIR), [], "decisions read should reset after clear");
assert.deepStrictEqual(readErrors(TEST_DIR), [], "errors read should reset after clear");
console.log("PASS: reads return empty defaults after clearSharedContext");

rmSync(TEST_DIR, { recursive: true });
rmSync(emptySummaryDir, { recursive: true });
rmSync(docsOnlyDir, { recursive: true });
rmSync(metricsDir, { recursive: true });
console.log("All shared context tests passed.");
