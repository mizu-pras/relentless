import {
  recordDispatch,
  getRoutingSuggestion,
  getAllRoutingSuggestions,
  formatRoutingSuggestions,
} from "./routing.js";
import { readLessons } from "./lessons.js";
import { mkdirSync, rmSync } from "fs";
import { join } from "path";
import assert from "assert";

const TEST_DIR = "/tmp/relentless-routing-test-" + Date.now();
mkdirSync(TEST_DIR, { recursive: true });

const dispatchDir = join(TEST_DIR, "dispatch");
recordDispatch(dispatchDir, {
  agent: "artisan",
  task_category: "deep",
  success: true,
  retry_count: 1,
  estimated_tokens: 1200,
  timestamp: "2026-03-12T05:00:00.000Z",
});

const createdLessons = readLessons(dispatchDir);
assert.strictEqual(createdLessons.length, 1, "recordDispatch should create one lesson");
assert.strictEqual(createdLessons[0].category, "agent_performance", "lesson category should be agent_performance");
assert.strictEqual(createdLessons[0].pattern, "agent_routing:deep:artisan", "pattern should encode routing dimensions");
assert.strictEqual(createdLessons[0].resolution, "1/1", "initial success should write 1/1 resolution");
assert.strictEqual(createdLessons[0].frequency, 1, "new lesson should have frequency=1");
assert.deepStrictEqual(createdLessons[0].examples, ["retries:1,tokens:1200"], "examples should store retry and token metadata");
assert.strictEqual(/^L-[0-9a-f]{8}$/.test(createdLessons[0].id), true, "routing lesson id should match expected format");
console.log("PASS: recordDispatch creates agent_performance lessons");

recordDispatch(dispatchDir, {
  agent: "artisan",
  task_category: "deep",
  success: false,
  retry_count: 3,
  estimated_tokens: 2400,
  timestamp: "2026-03-12T05:10:00.000Z",
});

const updatedLessons = readLessons(dispatchDir);
assert.strictEqual(updatedLessons.length, 1, "repeat dispatch for same agent/category should merge");
assert.strictEqual(updatedLessons[0].id, createdLessons[0].id, "routing lesson id should be deterministic");
assert.strictEqual(updatedLessons[0].frequency, 2, "repeat dispatch should increment frequency");
assert.strictEqual(updatedLessons[0].resolution, "1/2", "success rate should update as successes/total");
assert.strictEqual(updatedLessons[0].last_seen, "2026-03-12T05:10:00.000Z", "last_seen should update to latest timestamp");
assert.deepStrictEqual(
  updatedLessons[0].examples,
  ["retries:1,tokens:1200", "retries:3,tokens:2400"],
  "examples should append capped retry/token records",
);
console.log("PASS: recordDispatch updates frequency and success rate on repeats");

const learningDisabled = getRoutingSuggestion(dispatchDir, "deep");
assert.strictEqual(learningDisabled.suggested_agent, "artisan", "learning disabled should keep default agent");
assert.strictEqual(learningDisabled.confidence, 0, "learning disabled should have zero confidence");
assert.strictEqual(learningDisabled.reason.includes("Learning disabled"), true, "reason should explain static routing fallback");
console.log("PASS: getRoutingSuggestion returns default when learning disabled");

const insufficientData = getRoutingSuggestion(dispatchDir, "deep", {
  routing: { learning_enabled: true, min_data_points: 5 },
});
assert.strictEqual(insufficientData.suggested_agent, "artisan", "insufficient data should keep default agent");
assert.strictEqual(insufficientData.confidence, 0, "insufficient data should not produce confidence");
assert.strictEqual(insufficientData.data_points, 2, "data_points should include all observed dispatches for category");
assert.strictEqual(insufficientData.reason.includes("Insufficient data"), true, "reason should explain data threshold fallback");
console.log("PASS: getRoutingSuggestion returns default when data is below threshold");

const learnedDir = join(TEST_DIR, "learned");
for (let index = 0; index < 6; index++) {
  recordDispatch(learnedDir, {
    agent: "artisan",
    task_category: "deep",
    success: index === 5,
    retry_count: 1,
    estimated_tokens: 1600,
    timestamp: `2026-03-12T06:0${index}:00.000Z`,
  });
}
for (let index = 0; index < 6; index++) {
  recordDispatch(learnedDir, {
    agent: "sentinel",
    task_category: "deep",
    success: true,
    retry_count: 0,
    estimated_tokens: 1400,
    timestamp: `2026-03-12T06:1${index}:00.000Z`,
  });
}

const learnedSuggestion = getRoutingSuggestion(learnedDir, "deep", {
  routing: { learning_enabled: true, min_data_points: 5 },
});
assert.strictEqual(learnedSuggestion.default_agent, "artisan", "deep default should be artisan");
assert.strictEqual(learnedSuggestion.suggested_agent, "sentinel", "better-performing agent should override default");
assert.strictEqual(learnedSuggestion.confidence > 0, true, "learned override should report positive confidence");
assert.strictEqual(learnedSuggestion.data_points, 12, "data points should sum category totals across agents");
assert.strictEqual(learnedSuggestion.reason.includes("outperforms"), true, "reason should explain performance override");
console.log("PASS: getRoutingSuggestion suggests override with sufficient better data");

const unknownCategory = getRoutingSuggestion(learnedDir, "unknown_category", {
  routing: { learning_enabled: true, min_data_points: 5 },
});
assert.strictEqual(unknownCategory.default_agent, "artisan", "unknown categories should fall back to artisan default");
assert.strictEqual(unknownCategory.suggested_agent, "artisan", "unknown category with no data should remain default");
console.log("PASS: getRoutingSuggestion handles unknown categories gracefully");

const allSuggestions = getAllRoutingSuggestions(learnedDir, {
  routing: { learning_enabled: false, min_data_points: 5 },
});
assert.strictEqual(allSuggestions.length, 5, "getAllRoutingSuggestions should return all standard categories");
assert.deepStrictEqual(
  allSuggestions.map((entry) => entry.category),
  ["deep", "visual", "quick", "reason", "orchestrate"],
  "categories should match static routing keys",
);
console.log("PASS: getAllRoutingSuggestions returns all standard categories");

const noOverrideText = formatRoutingSuggestions([
  {
    category: "deep",
    default_agent: "artisan",
    suggested_agent: "artisan",
    confidence: 0,
    data_points: 0,
    reason: "No performance data",
  },
]);
assert.strictEqual(noOverrideText, "", "formatRoutingSuggestions should return empty string without overrides");
console.log("PASS: formatRoutingSuggestions returns empty string with no overrides");

const overrideText = formatRoutingSuggestions([
  {
    category: "deep",
    default_agent: "artisan",
    suggested_agent: "sentinel",
    confidence: 0.6,
    data_points: 8,
    reason: "sentinel outperforms artisan (83% success rate, 6 dispatches)",
  },
  {
    category: "visual",
    default_agent: "maestro",
    suggested_agent: "maestro",
    confidence: 0,
    data_points: 2,
    reason: "No performance data",
  },
]);
assert.strictEqual(overrideText.includes("## Routing Overrides (Learning-Based)"), true, "formatted output should include heading");
assert.strictEqual(overrideText.includes("**deep**: artisan -> sentinel"), true, "formatted output should include override line");
assert.strictEqual(overrideText.includes("visual"), false, "formatted output should omit non-overrides");
console.log("PASS: formatRoutingSuggestions formats only actual overrides");

rmSync(TEST_DIR, { recursive: true });
console.log("All routing tests passed.");
