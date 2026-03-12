import {
  TOKEN_COSTS,
  createTokenTracking,
  estimateDispatchCost,
  forecastBudget,
  formatCostSummary,
  recordDispatchCost,
  shouldCompactBeforeDispatch,
  updateActualCost,
} from "./token-budget.js";
import assert from "assert";

// Test 1: TOKEN_COSTS are positive numbers
for (const value of Object.values(TOKEN_COSTS) as number[]) {
  assert.ok(value > 0, "all token cost constants should be positive");
}
console.log("PASS: TOKEN_COSTS positive values");

// Test 2: estimateDispatchCost basic
const basicCost = estimateDispatchCost({
  fileReads: 0,
  toolCalls: 0,
  hasSkillLoading: false,
});
assert.strictEqual(
  basicCost,
  TOKEN_COSTS.HANDOFF_PROMPT + TOKEN_COSTS.RESPONSE_GENERATION,
  "basic dispatch cost should include handoff and response generation"
);
console.log("PASS: estimateDispatchCost basic");

// Test 3: estimateDispatchCost with files and tools
const detailedCost = estimateDispatchCost({
  fileReads: 3,
  toolCalls: 5,
  hasSkillLoading: true,
});
const expectedDetailedCost =
  TOKEN_COSTS.HANDOFF_PROMPT +
  3 * TOKEN_COSTS.FILE_READ +
  5 * TOKEN_COSTS.TOOL_CALL +
  TOKEN_COSTS.SKILL_LOADING +
  TOKEN_COSTS.RESPONSE_GENERATION;
assert.strictEqual(
  detailedCost,
  expectedDetailedCost,
  "detailed dispatch cost should include files, tools, skill loading, and response"
);
console.log("PASS: estimateDispatchCost with files and tools");

// Test 4: forecastBudget under threshold
const underThreshold = forecastBudget(
  50000,
  200000,
  [{ fileReads: 1, toolCalls: 1, hasSkillLoading: false }],
  0.75
);
assert.strictEqual(underThreshold.shouldCompact, false, "should not compact under threshold");
console.log("PASS: forecastBudget under threshold");

// Test 5: forecastBudget over threshold
const overThreshold = forecastBudget(
  140000,
  200000,
  [
    { fileReads: 3, toolCalls: 5, hasSkillLoading: true },
    { fileReads: 3, toolCalls: 5, hasSkillLoading: true },
  ],
  0.75
);
assert.strictEqual(overThreshold.shouldCompact, true, "should compact over threshold");
console.log("PASS: forecastBudget over threshold");

// Test 6: forecastBudget summary message
assert.ok(
  overThreshold.summary.includes("Compact before dispatching"),
  "summary should recommend compacting"
);
console.log("PASS: forecastBudget summary message");

// Test 7: forecastBudget zero dispatches
const zeroDispatches = forecastBudget(50000, 200000, [], 0.75);
assert.strictEqual(
  zeroDispatches.projectedUsage,
  50000 / 200000,
  "zero dispatches should keep projected usage at current usage fraction"
);
console.log("PASS: forecastBudget zero dispatches");

// Test 8: shouldCompactBeforeDispatch convenience
assert.strictEqual(
  shouldCompactBeforeDispatch(50000, 200000, 1),
  false,
  "low usage and one agent should not compact"
);
assert.strictEqual(
  shouldCompactBeforeDispatch(140000, 200000, 3),
  true,
  "high usage and three agents should compact"
);
console.log("PASS: shouldCompactBeforeDispatch convenience");

// Test 9: shouldCompactBeforeDispatch with custom threshold
assert.strictEqual(
  shouldCompactBeforeDispatch(130000, 200000, 1, 3, 0.65),
  true,
  "lower threshold should trigger compacting"
);
console.log("PASS: shouldCompactBeforeDispatch custom threshold");

// Test 10: forecastBudget with contextLimit=0 (Sentinel W-1 guard)
const zeroLimit = forecastBudget(50000, 0, [{ fileReads: 1, toolCalls: 1, hasSkillLoading: false }]);
assert.strictEqual(zeroLimit.shouldCompact, true, "contextLimit=0 should always recommend compaction");
assert.strictEqual(zeroLimit.projectedUsage, 1, "contextLimit=0 should set projectedUsage to 1");
assert.ok(zeroLimit.summary.includes("invalid context limit"), "summary should mention invalid context limit");
console.log("PASS: forecastBudget contextLimit=0 guard");

// Test 11: forecastBudget with negative contextLimit (Sentinel W-1 guard)
const negativeLimit = forecastBudget(50000, -100, [{ fileReads: 1, toolCalls: 1, hasSkillLoading: false }]);
assert.strictEqual(negativeLimit.shouldCompact, true, "negative contextLimit should always recommend compaction");
console.log("PASS: forecastBudget negative contextLimit guard");

// Test 12: createTokenTracking returns empty tracking state
const emptyTracking = createTokenTracking();
assert.deepStrictEqual(
  emptyTracking,
  {
    dispatches: [],
    total_estimated: 0,
    total_actual: 0,
  },
  "createTokenTracking should initialize empty dispatch and zero totals"
);
console.log("PASS: createTokenTracking initializes empty state");

// Test 13: recordDispatchCost adds dispatch record and estimate
const recordedOnce = recordDispatchCost(
  createTokenTracking(),
  "artisan",
  "T-003",
  { fileReads: 2, toolCalls: 4, hasSkillLoading: true }
);
assert.strictEqual(recordedOnce.dispatches.length, 1, "recordDispatchCost should append one dispatch");
assert.strictEqual(recordedOnce.dispatches[0].agent, "artisan", "dispatch record should include agent");
assert.strictEqual(recordedOnce.dispatches[0].task_id, "T-003", "dispatch record should include task id");
assert.strictEqual(
  recordedOnce.dispatches[0].estimated_tokens,
  estimateDispatchCost({ fileReads: 2, toolCalls: 4, hasSkillLoading: true }),
  "dispatch record should store computed estimate"
);
assert.ok(
  !Number.isNaN(Date.parse(recordedOnce.dispatches[0].timestamp)),
  "dispatch record should include ISO timestamp"
);
console.log("PASS: recordDispatchCost appends dispatch records");

// Test 14: recordDispatchCost accumulates total_estimated
const recordedTwice = recordDispatchCost(
  recordedOnce,
  "sentinel",
  "T-004",
  { fileReads: 1, toolCalls: 1, hasSkillLoading: false }
);
const expectedEstimatedTotal =
  estimateDispatchCost({ fileReads: 2, toolCalls: 4, hasSkillLoading: true }) +
  estimateDispatchCost({ fileReads: 1, toolCalls: 1, hasSkillLoading: false });
assert.strictEqual(
  recordedTwice.total_estimated,
  expectedEstimatedTotal,
  "recordDispatchCost should keep running estimate total"
);
console.log("PASS: recordDispatchCost accumulates total_estimated");

// Test 15: updateActualCost fills actual tokens for matching task id
const withActual = updateActualCost(recordedTwice, "T-003", 4200);
assert.strictEqual(withActual.dispatches[0].actual_tokens, 4200, "updateActualCost should set first matching missing actual");
assert.strictEqual(withActual.dispatches[1].actual_tokens, undefined, "non-matching dispatch should be unchanged");
console.log("PASS: updateActualCost updates matching dispatch");

// Test 16: updateActualCost accumulates total_actual
const withMoreActual = updateActualCost(withActual, "T-004", 1800);
assert.strictEqual(withMoreActual.total_actual, 6000, "updateActualCost should accumulate total actual tokens");
console.log("PASS: updateActualCost accumulates total_actual");

// Test 17: formatCostSummary handles empty tracking
assert.strictEqual(formatCostSummary(createTokenTracking()), "No dispatches recorded.", "empty tracking should show no dispatches message");
console.log("PASS: formatCostSummary handles empty tracking");

// Test 18: formatCostSummary formats per-agent breakdown
const summary = formatCostSummary(withMoreActual);
assert.ok(summary.includes("Total estimated:"), "summary should include total estimated line");
assert.ok(summary.includes("Total actual:"), "summary should include total actual line");
assert.ok(summary.includes("Per-agent:"), "summary should include per-agent section");
assert.ok(summary.includes("artisan:"), "summary should include artisan breakdown");
assert.ok(summary.includes("sentinel:"), "summary should include sentinel breakdown");
console.log("PASS: formatCostSummary formats multi-agent breakdown");

console.log("All token budget tests passed.");
