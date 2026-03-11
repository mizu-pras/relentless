import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";

const STATE_DIR = ".relentless";
const PURSUIT_FILE = "current-pursuit.json";
const HALT_FILE = "halt";

export interface PursuitTodo {
  id: string;
  subject: string;
  status: string;
  agent?: string;
}

export interface CircuitBreakerStatus {
  consecutive_failures?: number;
  injections_last_minute?: number;
}

export interface PursuitState {
  task?: string;
  todos?: PursuitTodo[];
  current_loop?: number;
  max_loops?: number;
  circuit_breaker?: CircuitBreakerStatus;
  config?: {
    circuit_breaker?: {
      max_consecutive_failures?: number;
    };
  };
  halted?: boolean;
  updated_at?: string;
  version?: number;
}

function stateDir(projectDir?: string): string {
  return join(projectDir || ".", STATE_DIR);
}

function ensureStateDir(projectDir?: string): string {
  const dir = stateDir(projectDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

export function readPursuitState(projectDir?: string): PursuitState | null {
  const path = join(stateDir(projectDir), PURSUIT_FILE);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as PursuitState;
  } catch {
    return null;
  }
}

export function writePursuitState(projectDir: string | undefined, state: PursuitState): PursuitState {
  const dir = ensureStateDir(projectDir);
  const path = join(dir, PURSUIT_FILE);
  const snapshot: PursuitState = {
    ...state,
    updated_at: new Date().toISOString(),
    version: 1,
  };
  writeFileSync(path, JSON.stringify(snapshot, null, 2), "utf8");
  return snapshot;
}

export function isHalted(projectDir?: string): boolean {
  return existsSync(join(stateDir(projectDir), HALT_FILE));
}

export function setHalt(projectDir: string | undefined, reason = "user requested"): void {
  const dir = ensureStateDir(projectDir);
  writeFileSync(
    join(dir, HALT_FILE),
    JSON.stringify({ timestamp: new Date().toISOString(), reason }),
    "utf8"
  );
}

export function clearHalt(projectDir?: string): void {
  const path = join(stateDir(projectDir), HALT_FILE);
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

export function formatStatus(state: PursuitState | null): string {
  if (!state) return "No active pursuit. Run /unleash to start one.";

  const todos = state.todos || [];
  const completed = todos.filter((t) => t.status === "completed").length;
  const inProgress = todos.filter((t) => t.status === "in_progress");
  const pending = todos.filter((t) => t.status === "pending");

  const assignments = inProgress
    .map((t) => `  ${t.agent || "unknown"}    → ${t.id} (in_progress): ${t.subject}`)
    .join("\n");

  const pendingList = pending.map((t) => `  ${t.id}: ${t.subject}`).join("\n");

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
