import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";

const STATE_DIR = ".relentless";
const PURSUIT_FILE = "current-pursuit.json";
const HALT_FILE = "halt";

/**
 * Get path to .relentless directory for the given project dir.
 */
function stateDir(projectDir) {
  return join(projectDir || ".", STATE_DIR);
}

/**
 * Ensure .relentless/ directory exists.
 */
function ensureStateDir(projectDir) {
  const dir = stateDir(projectDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

/**
 * Read current pursuit state. Returns null if not found.
 */
export function readPursuitState(projectDir) {
  const path = join(stateDir(projectDir), PURSUIT_FILE);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

/**
 * Write pursuit state snapshot.
 */
export function writePursuitState(projectDir, state) {
  const dir = ensureStateDir(projectDir);
  const path = join(dir, PURSUIT_FILE);
  const snapshot = {
    ...state,
    updated_at: new Date().toISOString(),
    version: 1,
  };
  writeFileSync(path, JSON.stringify(snapshot, null, 2), "utf8");
  return snapshot;
}

/**
 * Check if halt flag is set.
 */
export function isHalted(projectDir) {
  return existsSync(join(stateDir(projectDir), HALT_FILE));
}

/**
 * Set halt flag.
 */
export function setHalt(projectDir, reason = "user requested") {
  const dir = ensureStateDir(projectDir);
  writeFileSync(
    join(dir, HALT_FILE),
    JSON.stringify({ timestamp: new Date().toISOString(), reason }),
    "utf8"
  );
}

/**
 * Clear halt flag.
 */
export function clearHalt(projectDir) {
  const path = join(stateDir(projectDir), HALT_FILE);
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

/**
 * Format pursuit state for display in /status.
 */
export function formatStatus(state) {
  if (!state) return "No active pursuit. Run /unleash to start one.";

  const todos = state.todos || [];
  const completed = todos.filter((t) => t.status === "completed").length;
  const inProgress = todos.filter((t) => t.status === "in_progress");
  const pending = todos.filter((t) => t.status === "pending");

  const assignments = inProgress
    .map((t) => `  ${t.agent || "unknown"}    → ${t.id} (in_progress): ${t.subject}`)
    .join("\n");

  const pendingList = pending
    .map((t) => `  ${t.id}: ${t.subject}`)
    .join("\n");

  const cb = state.circuit_breaker || {};

  return `## Relentless Status

Pursuit: active (loop ${state.current_loop || 1}/${state.max_loops || 10})
Progress: ${todos.length > 0 ? Math.round((completed / todos.length) * 100) : 0}% (${completed} of ${todos.length} todos complete)

Active assignments:
${assignments || "  (none)"}

Pending todos:
${pendingList || "  (none)"}

Circuit breaker:
  Consecutive failures: ${cb.consecutive_failures || 0}/${state.config?.circuit_breaker?.max_consecutive_failures || 3}
  Injections this minute: ${cb.injections_last_minute || 0}/3

Halt flag: ${state.halted ? "SET" : "not set"}
Last snapshot: ${state.updated_at || "unknown"}`;
}
