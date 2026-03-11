import { readFileSync, existsSync } from "fs";
import { join } from "path";

const PLUGIN_ROOT = join(import.meta.dirname, "..");

/**
 * Load and merge relentless.jsonc config.
 * Priority: project-level > user-level > built-in defaults
 */
export function loadConfig(projectDir) {
  const defaults = {
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

  const userConfigPath = join(
    process.env.HOME || "~",
    ".config/opencode/relentless.jsonc"
  );
  const projectConfigPath = join(projectDir || ".", ".opencode/relentless.jsonc");

  let config = { ...defaults };

  // Load user-level config
  if (existsSync(userConfigPath)) {
    try {
      const userConfig = parseJsonc(readFileSync(userConfigPath, "utf8"));
      config = deepMerge(config, userConfig);
    } catch (e) {
      console.warn(`[relentless] Failed to parse ${userConfigPath}: ${e.message}`);
    }
  }

  // Load project-level config (highest priority)
  if (projectDir && existsSync(projectConfigPath)) {
    try {
      const projectConfig = parseJsonc(readFileSync(projectConfigPath, "utf8"));
      config = deepMerge(config, projectConfig);
    } catch (e) {
      console.warn(`[relentless] Failed to parse ${projectConfigPath}: ${e.message}`);
    }
  }

  return config;
}

function parseJsonc(text) {
  // Strip // line comments and /* block comments */
  const stripped = text
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(stripped);
}

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (
      source[key] &&
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      target[key] &&
      typeof target[key] === "object"
    ) {
      result[key] = deepMerge(target[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}
