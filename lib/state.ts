import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join, resolve } from "path";
import { clearSharedContext, readErrors } from "./shared-context.js";
import { clearCompactionSnapshot } from "./compaction.js";
import { readLessons, writeLessons, extractLessons, promoteToGlobal } from "./lessons.js";
import { loadConfig } from "./config.js";
import type { TokenTracking } from "./token-budget.js";

const STATE_DIR = ".relentless";
const PURSUIT_FILE = "current-pursuit.json";
const HALT_FILE = "halt";
const HISTORY_DIR = "history";
const ASSIGNMENTS_FILE = "agent-assignments.json";

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
  token_tracking?: TokenTracking;
  config?: {
    circuit_breaker?: {
      max_consecutive_failures?: number;
    };
  };
  halted?: boolean;
  updated_at?: string;
  version?: number;
}

export interface AgentAssignment {
  agent: string;
  files: string[];
  task_id?: string;
  assigned_at: string;
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

function sanitizeTaskName(task?: string): string {
  if (!task) return "untitled";
  const cleaned = task.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return cleaned || "untitled";
}

function archiveTimestamp(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
    pad(date.getHours()),
    pad(date.getMinutes()),
    pad(date.getSeconds()),
  ].join("-");
}

export function archiveCompleted(projectDir?: string): string | null {
  const dir = stateDir(projectDir);
  const currentPath = join(dir, PURSUIT_FILE);
  if (!existsSync(currentPath)) return null;

  const state = readPursuitState(projectDir);
  if (!state) return null;

  const historyDir = join(ensureStateDir(projectDir), HISTORY_DIR);
  if (!existsSync(historyDir)) {
    mkdirSync(historyDir, { recursive: true });
  }

  const now = new Date();
  const archiveName = `${archiveTimestamp(now)}-${sanitizeTaskName(state.task)}.json`;
  const archivePath = join(historyDir, archiveName);
  const archived = {
    ...state,
    archived_at: now.toISOString(),
  };

  writeFileSync(archivePath, JSON.stringify(archived, null, 2), "utf8");
  unlinkSync(currentPath);
  // Extract lessons from errors before clearing shared context
  try {
    const errors = readErrors(projectDir);
    if (errors.length > 0) {
      const existingLessons = readLessons(projectDir);
      const mergedLessons = extractLessons(errors, existingLessons);
      writeLessons(projectDir, mergedLessons);
    }
  } catch (e) {
    console.warn("[relentless] Failed to extract lessons during archive:", e);
  }
  // Promote lessons to global store if configured
  try {
    const config = loadConfig(projectDir);
    const lessonsConfig = (config as unknown as Record<string, Record<string, unknown>>).lessons;
    if (lessonsConfig?.share_globally) {
      const projectId = resolve(projectDir || ".").split("/").pop() || "unknown";
      promoteToGlobal(projectDir, projectId);
    }
  } catch (e) {
    console.warn("[relentless] Failed to promote lessons to global during archive:", e);
  }
  try {
    clearSharedContext(projectDir);
  } catch (e) {
    console.warn("[relentless] Failed to clear shared context after archive:", e);
  }
  try {
    clearCompactionSnapshot(projectDir);
  } catch (e) {
    console.warn("[relentless] Failed to clear compaction snapshot after archive:", e);
  }
  return archivePath;
}

export function readAssignments(projectDir?: string): AgentAssignment[] {
  const path = join(stateDir(projectDir), ASSIGNMENTS_FILE);
  if (!existsSync(path)) return [];
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8"));
    return Array.isArray(parsed) ? (parsed as AgentAssignment[]) : [];
  } catch {
    return [];
  }
}

export function writeAssignments(projectDir: string | undefined, assignments: AgentAssignment[]): void {
  const dir = ensureStateDir(projectDir);
  writeFileSync(join(dir, ASSIGNMENTS_FILE), JSON.stringify(assignments, null, 2), "utf8");
}

export function isFileAssigned(projectDir: string | undefined, filePath: string): AgentAssignment | null {
  const assignments = readAssignments(projectDir);
  const found = assignments.find((assignment) => assignment.files.includes(filePath));
  return found || null;
}

export function assignFiles(projectDir: string | undefined, agent: string, files: string[], taskId?: string): void {
  const assignments = readAssignments(projectDir).filter((assignment) => assignment.agent !== agent);
  assignments.push({
    agent,
    files,
    ...(taskId ? { task_id: taskId } : {}),
    assigned_at: new Date().toISOString(),
  });
  writeAssignments(projectDir, assignments);
}

export function releaseFiles(projectDir: string | undefined, agent: string): void {
  const assignments = readAssignments(projectDir).filter((assignment) => assignment.agent !== agent);
  writeAssignments(projectDir, assignments);
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
