import assert from "assert";
import { existsSync, mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";

import { loadConfig } from "./config.js";

const DEFAULTS = {
  categories: {
    deep: "artisan",
    visual: "maestro",
    quick: "scout",
    reason: "sentinel",
    orchestrate: "conductor",
  },
  circuit_breaker: {
    max_consecutive_failures: 3,
    max_injections_per_minute: 3,
    token_budget_threshold: 0.85,
    proactive_threshold: 0.75,
  },
  pursuit: {
    max_iterations: 10,
    require_progress: true,
    stall_limit: 2,
  },
  recon: {
    max_depth: 4,
    include_env_vars: true,
    include_dependencies: true,
  },
};

const originalHome = process.env.HOME;
const tempDirs: string[] = [];

function createTempDir(prefix: string): string {
  const dir = mkdtempSync(join(tmpdir(), prefix));
  tempDirs.push(dir);
  return dir;
}

function writeConfig(filePath: string, text: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
  writeFileSync(filePath, text);
}

function userConfigPath(homeDir: string): string {
  return join(homeDir, ".config/opencode/relentless.jsonc");
}

function projectConfigPath(projectDir: string): string {
  return join(projectDir, ".opencode/relentless.jsonc");
}

function runWithHome<T>(homeDir: string, fn: () => T): T {
  process.env.HOME = homeDir;
  return fn();
}

try {
  const defaultRoot = createTempDir("relentless-config-defaults-");
  const defaultHome = join(defaultRoot, "home");
  const defaultConfig = runWithHome(defaultHome, () => loadConfig("/nonexistent"));
  assert.deepStrictEqual(defaultConfig, DEFAULTS, "all defaults should load when no configs exist");
  console.log("PASS: loadConfig returns full defaults when no config file exists");

  const jsoncRoot = createTempDir("relentless-config-jsonc-");
  const jsoncHome = join(jsoncRoot, "home");
  writeConfig(
    userConfigPath(jsoncHome),
    `{
      // single-line comment
      "categories": {
        /* multi-line
           comment */
        "deep": "jsonc-artisan",
      },
      "pursuit": {
        "stall_limit": 9,
      },
    }`,
  );
  const jsoncConfig = runWithHome(jsoncHome, () => loadConfig("/nonexistent"));
  assert.strictEqual(jsoncConfig.categories.deep, "jsonc-artisan", "JSONC should parse category override");
  assert.strictEqual(jsoncConfig.pursuit.stall_limit, 9, "JSONC should parse trailing commas");
  assert.strictEqual(jsoncConfig.pursuit.max_iterations, 10, "JSONC merge should preserve defaults");
  console.log("PASS: loadConfig parses JSONC comments and trailing commas");

  const mergeRoot = createTempDir("relentless-config-merge-");
  const mergeHome = join(mergeRoot, "home");
  const mergeProject = join(mergeRoot, "project");
  writeConfig(
    userConfigPath(mergeHome),
    JSON.stringify({
      categories: { deep: "user-deep" },
      pursuit: { max_iterations: 20 },
      recon: { max_depth: 7 },
    }),
  );
  writeConfig(
    projectConfigPath(mergeProject),
    JSON.stringify({
      categories: { deep: "project-deep" },
      pursuit: { max_iterations: 30 },
    }),
  );
  const mergeConfig = runWithHome(mergeHome, () => loadConfig(mergeProject));
  assert.strictEqual(mergeConfig.categories.deep, "project-deep", "project config should override user config");
  assert.strictEqual(mergeConfig.pursuit.max_iterations, 30, "project pursuit should override user pursuit");
  assert.strictEqual(mergeConfig.recon.max_depth, 7, "user config should override defaults");
  assert.strictEqual(mergeConfig.categories.visual, "maestro", "defaults should remain when not overridden");
  console.log("PASS: loadConfig merge order is defaults -> user -> project");

  const partialRoot = createTempDir("relentless-config-partial-");
  const partialHome = join(partialRoot, "home");
  writeConfig(
    userConfigPath(partialHome),
    JSON.stringify({
      circuit_breaker: { max_consecutive_failures: 9 },
    }),
  );
  const partialConfig = runWithHome(partialHome, () => loadConfig("/nonexistent"));
  assert.strictEqual(partialConfig.circuit_breaker.max_consecutive_failures, 9, "partial override should apply");
  assert.strictEqual(partialConfig.circuit_breaker.max_injections_per_minute, 3, "other circuit defaults should persist");
  assert.strictEqual(partialConfig.circuit_breaker.token_budget_threshold, 0.85, "token budget default should persist");
  assert.strictEqual(partialConfig.categories.deep, "artisan", "unrelated defaults should persist");
  console.log("PASS: loadConfig applies partial overrides without losing defaults");

  const invalidRoot = createTempDir("relentless-config-invalid-");
  const invalidHome = join(invalidRoot, "home");
  const invalidPath = userConfigPath(invalidHome);
  writeConfig(invalidPath, `{"categories": {"deep": "broken", }`);

  let warningMessage = "";
  const originalWarn = console.warn;
  console.warn = (message?: unknown, ...optionalParams: unknown[]) => {
    warningMessage = [message, ...optionalParams].map((item) => String(item)).join(" ");
  };

  try {
    const invalidConfig = runWithHome(invalidHome, () => loadConfig("/nonexistent"));
    assert.deepStrictEqual(invalidConfig, DEFAULTS, "invalid config should fall back to defaults");
    assert.ok(warningMessage.includes("Failed to parse"), "invalid config should emit parse warning");
    assert.ok(warningMessage.includes(invalidPath), "warning should include failing file path");
  } finally {
    console.warn = originalWarn;
  }
  console.log("PASS: loadConfig warns and falls back to defaults on invalid JSON");

  const deepMergeRoot = createTempDir("relentless-config-deep-merge-");
  const deepMergeHome = join(deepMergeRoot, "home");
  const deepMergeProject = join(deepMergeRoot, "project");
  writeConfig(
    userConfigPath(deepMergeHome),
    JSON.stringify({
      pursuit: { max_iterations: 42 },
    }),
  );
  writeConfig(
    projectConfigPath(deepMergeProject),
    JSON.stringify({
      pursuit: { stall_limit: 5 },
    }),
  );
  const deepMergeConfig = runWithHome(deepMergeHome, () => loadConfig(deepMergeProject));
  assert.strictEqual(deepMergeConfig.pursuit.max_iterations, 42, "nested user override should persist");
  assert.strictEqual(deepMergeConfig.pursuit.stall_limit, 5, "nested project override should apply");
  assert.strictEqual(deepMergeConfig.pursuit.require_progress, true, "nested defaults should be preserved");
  console.log("PASS: loadConfig deeply merges nested pursuit fields");

  console.log("All config tests passed.");
} finally {
  process.env.HOME = originalHome;
  for (const dir of tempDirs) {
    if (existsSync(dir)) {
      rmSync(dir, { recursive: true, force: true });
    }
  }
}
