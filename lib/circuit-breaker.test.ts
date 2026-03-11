import { classifyError, ErrorType, shouldRetry, CircuitBreaker } from "./circuit-breaker.js";
import assert from "assert";

// Test Layer 1: error classification
assert.strictEqual(
  classifyError(new Error("context_length_exceeded")),
  ErrorType.TOKEN_LIMIT,
  "should classify token limit error"
);
assert.strictEqual(
  classifyError({ status: 429, message: "rate limit" }),
  ErrorType.RATE_LIMIT,
  "should classify rate limit"
);
assert.strictEqual(
  classifyError({ name: "AbortError", message: "aborted" }),
  ErrorType.ABORT,
  "should classify abort"
);
console.log("PASS: Layer 1 error classification");

// Test Layer 1: shouldRetry
assert.strictEqual(shouldRetry(ErrorType.TOKEN_LIMIT), false, "token limit should not retry");
assert.strictEqual(shouldRetry(ErrorType.RATE_LIMIT), true, "rate limit should retry");
assert.strictEqual(shouldRetry(ErrorType.ABORT), false, "abort should not retry");
console.log("PASS: Layer 1 shouldRetry");

// Test Layer 2: consecutive failure circuit breaker
const cb = new CircuitBreaker({ max_consecutive_failures: 3 });
const r1 = cb.recordFailure({ status: 503, message: "network" });
assert.strictEqual(r1.open, false, "first failure should not open circuit");
const r2 = cb.recordFailure({ status: 503, message: "network" });
assert.strictEqual(r2.open, true, "same error twice should open circuit");
console.log("PASS: Layer 2 same-error-twice opens circuit");

const cb2 = new CircuitBreaker({ max_consecutive_failures: 3 });
cb2.recordFailure({ status: 429, message: "rate limit" });
cb2.recordSuccess();
cb2.recordFailure({ status: 503, message: "network" });
cb2.recordFailure({ status: 503, message: "network" });
const r3 = cb2.recordFailure({ status: 503, message: "network" });
assert.strictEqual(r3.open, true, "3 consecutive failures should open circuit");
console.log("PASS: Layer 2 max consecutive failures opens circuit");

const cb3 = new CircuitBreaker();
const r4 = cb3.recordFailure(new Error("prompt is too long — context_length_exceeded"));
assert.strictEqual(r4.open, true, "token limit should open circuit immediately");
console.log("PASS: Layer 2 token limit opens immediately");

const cb4 = new CircuitBreaker({ max_injections_per_minute: 3 });
assert.strictEqual(cb4.canInject(), true, "first injection allowed");
assert.strictEqual(cb4.canInject(), true, "second injection allowed");
assert.strictEqual(cb4.canInject(), true, "third injection allowed");
assert.strictEqual(cb4.canInject(), false, "fourth injection blocked");
console.log("PASS: Layer 3 injection rate limiter");

const cb5 = new CircuitBreaker({ token_budget_threshold: 0.85 });
assert.strictEqual(cb5.checkTokenBudget(0.7), true, "70% usage should be allowed");
assert.strictEqual(cb5.checkTokenBudget(0.9), false, "90% usage should be blocked");
assert.strictEqual(cb5.checkTokenBudget(null), true, "unknown usage should be allowed");
console.log("PASS: Layer 4 token budget awareness");

console.log("All circuit breaker tests passed.");
