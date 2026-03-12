import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";

const STATE_DIR = ".relentless";
const COMPACTION_FILE = "last-compaction.json";

export interface CompactionSnapshot {
  /** ISO timestamp of this compaction */
  compacted_at: string;
  /** Number of compactions so far */
  compaction_count: number;
  /** Task description at time of compaction */
  task: string;
  /** Loop number at time of compaction */
  current_loop: number;
  /** Map of todo ID → status at time of compaction */
  todo_statuses: Record<string, string>;
  /** Circuit breaker consecutive failures at compaction */
  cb_failures: number;
}

function snapshotPath(projectDir?: string): string {
  return join(projectDir || ".", STATE_DIR, COMPACTION_FILE);
}

/**
 * Read the last compaction snapshot. Returns null if none exists.
 */
export function readCompactionSnapshot(projectDir?: string): CompactionSnapshot | null {
  const path = snapshotPath(projectDir);
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, "utf8")) as CompactionSnapshot;
  } catch {
    return null;
  }
}

/**
 * Save a compaction snapshot for future differential comparison.
 *
 * @param projectDir - Project directory
 * @param state - Current pursuit state
 * @param prev - Previous snapshot (pass the already-read snapshot to avoid redundant disk reads)
 */
export function saveCompactionSnapshot(
  projectDir: string | undefined,
  state: any,
  prev?: CompactionSnapshot | null
): CompactionSnapshot {
  const dir = join(projectDir || ".", STATE_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Use provided prev or read from disk (fallback for direct callers)
  const prevSnap = prev !== undefined ? prev : readCompactionSnapshot(projectDir);
  const todos: Array<{ id: string; status: string }> = state.todos || [];
  const todoStatuses: Record<string, string> = {};
  for (const t of todos) {
    todoStatuses[t.id] = t.status;
  }

  // compaction_count tracks how many compactions have occurred.
  // prev.compaction_count is the count from the *last saved* snapshot,
  // so +1 gives the current compaction's ordinal.
  const snapshot: CompactionSnapshot = {
    compacted_at: new Date().toISOString(),
    compaction_count: (prevSnap?.compaction_count || 0) + 1,
    task: state.task || "",
    current_loop: state.current_loop || 1,
    todo_statuses: todoStatuses,
    cb_failures: state.circuit_breaker?.consecutive_failures || 0,
  };

  writeFileSync(snapshotPath(projectDir), JSON.stringify(snapshot, null, 2), "utf8");
  return snapshot;
}

/**
 * Clear the compaction snapshot. Call when archiving a pursuit
 * to prevent stale snapshots from contaminating the next pursuit.
 */
export function clearCompactionSnapshot(projectDir?: string): void {
  const path = snapshotPath(projectDir);
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

/**
 * Format differential compaction context.
 *
 * On first compaction: full state dump (same as before).
 * On subsequent compactions: only include what changed since last snapshot.
 *
 * Returns a string suitable for injection into the compaction context.
 */
export function formatDifferentialContext(state: any, prev: CompactionSnapshot | null): string {
  const todos: Array<{ id: string; subject: string; status: string; agent?: string }> = state.todos || [];
  const completed = todos.filter((t) => t.status === "completed");
  const pending = todos.filter((t) => t.status !== "completed");

  // First compaction or stale snapshot from a different pursuit: full context
  if (!prev || prev.task !== (state.task || "")) {
    return `## Relentless Orchestration State (Preserved Through Compaction)
Task: ${state.task}
Progress: Loop ${state.current_loop || 1}/${state.max_loops || 10}
Completed: ${completed.length}/${todos.length} todos

Pending todos:
${pending.map((t) => `  [${t.status}] ${t.id}: ${t.subject}${t.agent ? ` (${t.agent})` : ""}`).join("\n") || "  (none)"}

Circuit breaker: ${state.circuit_breaker?.consecutive_failures || 0}/${state.config?.circuit_breaker?.max_consecutive_failures || 3} failures
Last updated: ${state.updated_at}

IMPORTANT: Continue the pursuit from the state above. Do not restart from the beginning.`;
  }

  // Subsequent compaction: differential
  const parts: string[] = [];
  parts.push(`## Relentless State Update (Compaction #${prev.compaction_count + 1})`);
  parts.push(`Task: ${state.task} (unchanged)`);
  parts.push(`Progress: Loop ${state.current_loop || 1}/${state.max_loops || 10} — ${completed.length}/${todos.length} todos done`);

  // Find status changes since last compaction
  const changes: string[] = [];
  for (const t of todos) {
    const prevStatus = prev.todo_statuses[t.id];
    if (!prevStatus) {
      changes.push(`  + NEW [${t.status}] ${t.id}: ${t.subject}`);
    } else if (prevStatus !== t.status) {
      changes.push(`  Δ ${prevStatus} → ${t.status}: ${t.id}: ${t.subject}`);
    }
  }
  // Detect removed todos
  for (const [id, status] of Object.entries(prev.todo_statuses)) {
    if (!todos.find((t) => t.id === id)) {
      changes.push(`  - REMOVED: ${id} (was ${status})`);
    }
  }

  if (changes.length > 0) {
    parts.push(`\nChanges since last compaction:`);
    parts.push(changes.join("\n"));
  } else {
    parts.push(`\nNo todo changes since last compaction.`);
  }

  // Only show pending todos (still needed for agent orientation)
  if (pending.length > 0) {
    parts.push(`\nRemaining work:`);
    parts.push(pending.map((t) => `  [${t.status}] ${t.id}: ${t.subject}${t.agent ? ` (${t.agent})` : ""}`).join("\n"));
  }

  // Circuit breaker: only if changed
  const currentCbFailures = state.circuit_breaker?.consecutive_failures || 0;
  if (currentCbFailures !== prev.cb_failures) {
    parts.push(`\nCircuit breaker: ${currentCbFailures}/${state.config?.circuit_breaker?.max_consecutive_failures || 3} failures (was ${prev.cb_failures})`);
  }

  parts.push(`\nIMPORTANT: Continue the pursuit. Do not restart from the beginning.`);

  return parts.join("\n");
}
