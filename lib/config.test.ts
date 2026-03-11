import { loadConfig } from "./config.js";
import assert from "assert";

const config = loadConfig("/nonexistent");
assert.strictEqual(config.pursuit.max_iterations, 10, "default max_iterations should be 10");
assert.strictEqual(config.circuit_breaker.max_consecutive_failures, 3, "default failures should be 3");
assert.strictEqual(config.categories.deep, "artisan", "deep category should map to artisan");
console.log("PASS: loadConfig returns defaults when no config file");

const merged = { pursuit: { max_iterations: 5, require_progress: true, stall_limit: 2 } };
assert.strictEqual(typeof config.categories, "object", "categories should be an object");
console.log("PASS: config structure is correct");

console.log("All config tests passed.");
