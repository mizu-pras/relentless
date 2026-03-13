import { readFileSync, existsSync } from "fs";
import { join } from "path";

import { parseJsonc } from "./jsonc.js";

interface CategoriesConfig {
  deep: string;
  visual: string;
  quick: string;
  reason: string;
  orchestrate: string;
}

interface CircuitBreakerConfig {
  max_consecutive_failures: number;
  max_injections_per_minute: number;
  token_budget_threshold: number;
  proactive_threshold: number;
}

interface PursuitConfig {
  max_iterations: number;
  require_progress: boolean;
  stall_limit: number;
}

interface ReconConfig {
  max_depth: number;
  include_env_vars: boolean;
  include_dependencies: boolean;
}

interface TemplatesConfig {
  enabled: boolean;
  auto_suggest: boolean;
  custom_dir: string | null;
}

interface BranchingConfig {
  enabled: boolean;
  max_branches: number;
  worktree_dir: string;
}

export interface RelentlessConfig {
  categories: CategoriesConfig;
  circuit_breaker: CircuitBreakerConfig;
  pursuit: PursuitConfig;
  recon: ReconConfig;
  templates: TemplatesConfig;
  branching: BranchingConfig;
}

type JsonObject = Record<string, unknown>;

export function loadConfig(projectDir?: string): RelentlessConfig {
  const defaults: RelentlessConfig = {
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
    templates: {
      enabled: true,
      auto_suggest: true,
      custom_dir: null,
    },
    branching: {
      enabled: true,
      max_branches: 3,
      worktree_dir: ".worktrees",
    },
  };

  const userConfigPath = join(process.env.HOME || "~", ".config/opencode/relentless.jsonc");
  const projectConfigPath = join(projectDir || ".", ".opencode/relentless.jsonc");

  let config: RelentlessConfig = { ...defaults };

  if (existsSync(userConfigPath)) {
    try {
      const userConfig = parseJsonc(readFileSync(userConfigPath, "utf8")) as JsonObject;
      config = deepMerge(config as unknown as JsonObject, userConfig) as unknown as RelentlessConfig;
    } catch (e: unknown) {
      console.warn(`[relentless] Failed to parse ${userConfigPath}: ${(e as Error).message}`);
    }
  }

  if (projectDir && existsSync(projectConfigPath)) {
    try {
      const projectConfig = parseJsonc(readFileSync(projectConfigPath, "utf8")) as JsonObject;
      config = deepMerge(config as unknown as JsonObject, projectConfig) as unknown as RelentlessConfig;
    } catch (e: unknown) {
      console.warn(`[relentless] Failed to parse ${projectConfigPath}: ${(e as Error).message}`);
    }
  }

  return config;
}

function isPlainObject(value: unknown): value is JsonObject {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function deepMerge<T extends JsonObject, U extends JsonObject>(target: T, source: U): T & U {
  const result: JsonObject = { ...target };
  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = target[key as keyof T] as unknown;

    if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
      result[key] = deepMerge(targetValue, sourceValue);
    } else {
      result[key] = sourceValue;
    }
  }
  return result as T & U;
}
