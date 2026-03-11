import { readFileSync, existsSync } from "fs";
import { join } from "path";

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

export interface RelentlessConfig {
  categories: CategoriesConfig;
  circuit_breaker: CircuitBreakerConfig;
  pursuit: PursuitConfig;
  recon: ReconConfig;
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

  const userConfigPath = join(process.env.HOME || "~", ".config/opencode/relentless.jsonc");
  const projectConfigPath = join(projectDir || ".", ".opencode/relentless.jsonc");

  let config: RelentlessConfig = { ...defaults };

  if (existsSync(userConfigPath)) {
    try {
      const userConfig = parseJsonc(readFileSync(userConfigPath, "utf8"));
      config = deepMerge(config as unknown as JsonObject, userConfig) as unknown as RelentlessConfig;
    } catch (e: unknown) {
      console.warn(`[relentless] Failed to parse ${userConfigPath}: ${(e as Error).message}`);
    }
  }

  if (projectDir && existsSync(projectConfigPath)) {
    try {
      const projectConfig = parseJsonc(readFileSync(projectConfigPath, "utf8"));
      config = deepMerge(config as unknown as JsonObject, projectConfig) as unknown as RelentlessConfig;
    } catch (e: unknown) {
      console.warn(`[relentless] Failed to parse ${projectConfigPath}: ${(e as Error).message}`);
    }
  }

  return config;
}

function parseJsonc(text: string): JsonObject {
  const stripped = text
    .replace(/\/\/.*$/gm, "")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/,(\s*[}\]])/g, "$1");
  return JSON.parse(stripped) as JsonObject;
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
