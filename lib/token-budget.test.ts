import {
  TOKEN_COSTS,
  estimateDispatchCost,
  forecastBudget,
  shouldCompactBeforeDispatch,
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

console.log("All token budget tests passed.");
