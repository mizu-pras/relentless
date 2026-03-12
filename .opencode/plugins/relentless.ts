import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import type { Plugin } from "@opencode-ai/plugin";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "../..");

async function getState(): Promise<{
  readPursuitState: (dir?: string) => any;
  writePursuitState: (dir: string | undefined, state: any) => any;
  isHalted: (dir?: string) => boolean;
  formatStatus: (state: any) => string;
}> {
  const mod = (await import(join(PLUGIN_ROOT, "lib/dist/state.js"))) as any;
  return {
    readPursuitState: mod.readPursuitState,
    writePursuitState: mod.writePursuitState,
    isHalted: mod.isHalted,
    formatStatus: mod.formatStatus,
  };
}

async function getCircuitBreaker(): Promise<any> {
  const mod = (await import(join(PLUGIN_ROOT, "lib/dist/circuit-breaker.js"))) as any;
  return mod.CircuitBreaker;
}

async function getConfig(dir: string | undefined): Promise<any> {
  const mod = (await import(join(PLUGIN_ROOT, "lib/dist/config.js"))) as any;
  return mod.loadConfig(dir);
}

async function getSharedContext(): Promise<{
  formatSharedContext: (dir?: string, maxDecisions?: number, maxErrors?: number) => string;
}> {
  const mod = (await import(join(PLUGIN_ROOT, "lib/dist/shared-context.js"))) as any;
  return {
    formatSharedContext: mod.formatSharedContext,
  };
}

async function getLessons(): Promise<{
  readLessons: (dir?: string, maxEntries?: number) => any[];
  readGlobalLessons: (maxEntries?: number) => any[];
  formatLessonsForContext: (lessons: any[], maxLessons?: number) => string;
}> {
  const mod = (await import(join(PLUGIN_ROOT, "lib/dist/lessons.js"))) as any;
  return {
    readLessons: mod.readLessons,
    readGlobalLessons: mod.readGlobalLessons,
    formatLessonsForContext: mod.formatLessonsForContext,
  };
}

async function getRouting(): Promise<{
  recordDispatch: (dir: string | undefined, record: any) => void;
}> {
  const mod = (await import(join(PLUGIN_ROOT, "lib/dist/routing.js"))) as any;
  return {
    recordDispatch: mod.recordDispatch,
  };
}

async function getCompaction(): Promise<{
  readCompactionSnapshot: (dir?: string) => any;
  saveCompactionSnapshot: (dir: string | undefined, state: any, prev?: any) => any;
  formatDifferentialContext: (state: any, prev: any) => string;
}> {
  const mod = (await import(join(PLUGIN_ROOT, "lib/dist/compaction.js"))) as any;
  return {
    readCompactionSnapshot: mod.readCompactionSnapshot,
    saveCompactionSnapshot: mod.saveCompactionSnapshot,
    formatDifferentialContext: mod.formatDifferentialContext,
  };
}

function readSkill(skillName: string, variant = "SKILL"): string {
  const resolved = join(PLUGIN_ROOT, `skills/${skillName}/${variant}.md`);
  if (!resolved.startsWith(PLUGIN_ROOT + "/")) return ""; // path traversal guard
  if (!existsSync(resolved)) return "";
  return readFileSync(resolved, "utf8").replace(/^---[\s\S]*?---\n/, "").trim();
}

// Slash-free command keywords that can trigger commands without "/" prefix.
// Matches: "unleash - build X", "pursuit", "halt clear", etc.
const COMMAND_KEYWORDS = ["unleash", "pursuit", "recon", "resume", "status", "halt"];
const COMMAND_PATTERN = new RegExp(
  `^(${COMMAND_KEYWORDS.join("|")})(?:\\s*[-–—:]\\s*|\\s+)(.+)$|^(${COMMAND_KEYWORDS.join("|")})\\s*$`,
  "is",
);

function readCommandFile(command: string, args: string): string | null {
  const resolved = join(PLUGIN_ROOT, `commands/${command}.md`);
  if (!resolved.startsWith(PLUGIN_ROOT + "/")) return null; // path traversal guard
  if (!existsSync(resolved)) return null;

  let content = readFileSync(resolved, "utf8");
  // Strip frontmatter
  content = content.replace(/^---[\s\S]*?---\n/, "").trim();
  // Replace $ARGUMENTS placeholder with actual args
  content = content.replace(/\$ARGUMENTS/g, args);
  return content;
}

function readAgentModel(agentName: string): string {
  const resolved = join(PLUGIN_ROOT, `agents/${agentName}.md`);
  if (!resolved.startsWith(PLUGIN_ROOT + "/")) return ""; // path traversal guard
  if (!existsSync(resolved)) return "";

  const content = readFileSync(resolved, "utf8");
  const frontmatter = content.match(/^---\n([\s\S]*?)\n---\n/);
  if (!frontmatter) return "";

  const modelLine = frontmatter[1].match(/^model:\s*(.+)$/m);
  return modelLine?.[1]?.trim() ?? "";
}

const circuitBreakers = new Map<string, any>();
const sessionTokenUsage = new Map<string, number>();
const sessionContextLimits = new Map<string, number>();
// Track which todos have been recorded as dispatch outcomes to avoid duplicates.
const recordedTodos = new Map<string, Set<string>>();

// Reverse mapping: agent name → task category for routing records.
const AGENT_TO_CATEGORY: Record<string, string> = {
  artisan: "deep",
  maestro: "visual",
  sentinel: "reason",
  scout: "quick",
  conductor: "orchestrate",
};

const RelentlessPlugin: Plugin = async ({ client, directory }) => {
  const configuredConductorModel = readAgentModel("conductor");
  const conductorModel = configuredConductorModel || "anthropic/claude-opus-4-6";
  const intentGateContent = readSkill("intent-gate");
  const todoEnforcerContent = readSkill("todo-enforcer");
  const usingRelentlessContent = readSkill("using-relentless");
  const usingRelentlessExtended = readSkill("using-relentless", "SKILL-EXTENDED");
  if (!configuredConductorModel) {
    console.warn("[relentless] Missing conductor model in agents/conductor.md frontmatter; using fallback model");
  }
  if (!intentGateContent) {
    console.warn("[relentless] Missing required skill content: intent-gate");
  }
  if (!todoEnforcerContent) {
    console.warn("[relentless] Missing required skill content: todo-enforcer");
  }
  if (!usingRelentlessContent) {
    console.warn("[relentless] Missing required skill content: using-relentless");
  }
  if (!usingRelentlessExtended) {
    console.warn("[relentless] Missing optional skill content: using-relentless/SKILL-EXTENDED (skill discipline will be omitted during pursuit)");
  }

  // Agent catalog injected into the system prompt for routing/discovery context.
  const agentCatalog = `
## Relentless Agent Catalog

You have access to these specialized agents:
- **conductor** (Claude Opus): Orchestrator. Plans, delegates, validates. Use for /unleash.
- **artisan** (GPT-5.3 Codex): Deep coder. Complex implementation, backend, refactoring.
- **maestro** (GPT-5.3 Codex): UI/UX specialist. Visual/aesthetic-primary tasks only.
- **sentinel** (Claude Sonnet): Debugger and architect. Root cause tracing, code review.
- **scout** (zai-coding-plan/GLM-5): Fast explorer. Read-only codebase recon and file search.

Authority: conductor > sentinel > artisan/maestro > scout
Category routing: deep→artisan, visual→maestro, quick→scout, reason→sentinel, orchestrate→conductor
`.trim();

  return {
    config: async (input) => {
      input.agent ??= {};
      input.agent.general ??= {};
      input.agent.general.model = conductorModel;
    },

    // Slash-free command interception: rewrite "unleash - task" → command template
    "chat.message": async (_input, output) => {
      // Find the first text part in the user message
      const textPart = output.parts.find(
        (p): p is typeof p & { type: "text"; text: string } => p.type === "text" && typeof (p as any).text === "string",
      );
      if (!textPart) return;

      const text = (textPart as any).text.trim();
      if (!text) return;

      const match = text.match(COMMAND_PATTERN);
      if (!match) return;

      // match[1] = keyword (with args), match[2] = args, match[3] = keyword (no args)
      const command = (match[1] || match[3]).toLowerCase();
      const args = (match[2] || "").trim();

      const rewritten = readCommandFile(command, args);
      if (rewritten) {
        (textPart as any).text = rewritten;
      }
    },

    "experimental.chat.system.transform": async (_input, output) => {
      const parts: string[] = [];

      // Always inject lightweight bootstrap (commands, rules, skill index)
      if (usingRelentlessContent) {
        parts.push(`<RELENTLESS_BOOTSTRAP>\n${usingRelentlessContent}\n</RELENTLESS_BOOTSTRAP>`);
      }

      // Only inject heavy context (agent catalog, skill discipline, intent-gate,
      // todo-enforcer) when an active pursuit exists. This saves ~900 tokens
      // on every non-orchestration interaction.
      try {
        const { readPursuitState } = await getState();
        const state = readPursuitState(directory);
        if (state) {
          parts.push(`<RELENTLESS_AGENTS>\n${agentCatalog}\n</RELENTLESS_AGENTS>`);
          if (usingRelentlessExtended) {
            parts.push(`<RELENTLESS_SKILL_DISCIPLINE>\n${usingRelentlessExtended}\n</RELENTLESS_SKILL_DISCIPLINE>`);
          }
          if (intentGateContent) {
            parts.push(`<RELENTLESS_INTENT_GATE>\n${intentGateContent}\n</RELENTLESS_INTENT_GATE>`);
          }
          if (todoEnforcerContent) {
            parts.push(`<RELENTLESS_TODO_ENFORCER>\n${todoEnforcerContent}\n</RELENTLESS_TODO_ENFORCER>`);
          }
        }
      } catch (e) {
        console.warn("[relentless] Failed to load state module, skipping conditional injection:", e);
      }

      // Inject learned lessons from past pursuits (persistent across sessions)
      try {
        const { readLessons, formatLessonsForContext } = await getLessons();
        const lessons = readLessons(directory, 10);
        const lessonsContext = formatLessonsForContext(lessons);
        if (lessonsContext) {
          parts.push(`<RELENTLESS_LESSONS>\n${lessonsContext}\n</RELENTLESS_LESSONS>`);
        }
      } catch (e) {
        console.warn("[relentless] Failed to load lessons for system prompt:", e);
      }

      // Inject global lessons (if sharing enabled in config)
      try {
        const config = await getConfig(directory);
        if (config?.lessons?.share_globally) {
          const { readGlobalLessons, formatLessonsForContext } = await getLessons();
          const globalLessons = readGlobalLessons(5);
          const globalContext = formatLessonsForContext(globalLessons, 5);
          if (globalContext) {
            const relabeled = globalContext.replace(
              "## Learned Lessons (from previous pursuits)",
              "## Global Lessons (cross-project patterns)",
            );
            parts.push(`<RELENTLESS_GLOBAL_LESSONS>\n${relabeled}\n</RELENTLESS_GLOBAL_LESSONS>`);
          }
        }
      } catch (e) {
        console.warn("[relentless] Failed to load global lessons:", e);
      }

      if (parts.length > 0) {
        (output.system ||= []).push(parts.join("\n\n"));
      }
    },

    "experimental.session.compacting": async (_input, output) => {
      try {
        const { readPursuitState } = await getState();
        const state = readPursuitState(directory);
        if (!state) return;

        try {
          const { readCompactionSnapshot, saveCompactionSnapshot, formatDifferentialContext } = await getCompaction();
          const prev = readCompactionSnapshot(directory);
          const stateContext = formatDifferentialContext(state, prev);
          (output.context ||= []).push(stateContext);
          saveCompactionSnapshot(directory, state, prev);
        } catch (e) {
          // Fallback: if compaction module fails, use basic format
          console.warn("[relentless] Differential compaction failed, using fallback:", e);
          const todos = state.todos || [];
          const completed = todos.filter((t: any) => t.status === "completed");
          const pending = todos.filter((t: any) => t.status !== "completed");
          const fallback = `## Relentless State (Compaction Fallback)
Task: ${state.task}
Progress: Loop ${state.current_loop || 1}/${state.max_loops || 10} — ${completed.length}/${todos.length} done
Pending: ${pending.map((t: any) => `${t.id}: ${t.subject}`).join(", ") || "(none)"}
IMPORTANT: Continue the pursuit. Do not restart.`;
          (output.context ||= []).push(fallback);
        }

        try {
          const { formatSharedContext } = await getSharedContext();
          const sharedCtx = formatSharedContext(directory, 10, 5);
          if (sharedCtx) {
            (output.context ||= []).push(sharedCtx);
          }
        } catch (e) {
          console.warn("[relentless] Failed to include shared context in compaction:", e);
        }
      } catch (e) {
        console.warn("[relentless] Failed to preserve pursuit state during compaction:", e);
      }
    },

    event: async ({ event }: { event: any }) => {
      try {
        const sessionID = event?.sessionID;
        if (!sessionID) return;

        if (event.type === "message.updated") {
          const msg = event?.properties?.info;
          if (msg?.role === "assistant" && msg?.tokens?.input) {
            const tokenIncrement = msg.tokens.input + (msg.tokens.output || 0);
            const cumulative = (sessionTokenUsage.get(sessionID) || 0) + tokenIncrement;
            sessionTokenUsage.set(sessionID, cumulative);

            const contextLimit = msg?.model?.limit?.context || 200000;
            sessionContextLimits.set(sessionID, contextLimit);

            const cb = circuitBreakers.get(sessionID);
            if (cb) {
              const usage = cumulative / contextLimit;
              if (!cb.checkTokenBudget(usage)) {
                cb.markStalled();
              }
            }
          }
        }

        if (event.type === "session.error") {
          const CircuitBreaker = await getCircuitBreaker();
          if (!circuitBreakers.has(sessionID)) {
            const config = await getConfig(directory);
            circuitBreakers.set(sessionID, new CircuitBreaker(config.circuit_breaker));
          }
          const cb = circuitBreakers.get(sessionID);
          cb.recordFailure(event.error);
        }

        if (event.type === "session.idle" || event.type === "message") {
          try {
            const { readPursuitState, writePursuitState } = await getState();
            const state = readPursuitState(directory);
            if (state) {
              const cb = circuitBreakers.get(sessionID);
              if (cb) {
                state.circuit_breaker = {
                  ...cb.getStatus(),
                  token_usage: sessionTokenUsage.get(sessionID) || 0,
                  context_limit: sessionContextLimits.get(sessionID) || 200000,
                };
              }

              // Persist session-level token usage as total_actual snapshot.
              // Note: this is a session-level cumulative counter, not a per-dispatch sum.
              // See TokenTracking JSDoc in token-budget.ts for details.
              if (!state.token_tracking) {
                state.token_tracking = { dispatches: [], total_estimated: 0, total_actual: 0 };
              }
              state.token_tracking.total_actual = sessionTokenUsage.get(sessionID) || 0;

              // Auto-record dispatch outcomes for learning-based routing.
              // Detects newly completed/cancelled todos with agent assignments
              // and records them via recordDispatch() for future routing decisions.
              try {
                const config = await getConfig(directory);
                if (config?.routing?.learning_enabled) {
                  if (!recordedTodos.has(sessionID)) {
                    recordedTodos.set(sessionID, new Set());
                  }
                  const seen = recordedTodos.get(sessionID)!;
                  const todos: any[] = Array.isArray(state.todos) ? state.todos : [];
                  const newlyFinished = todos.filter(
                    (t: any) =>
                      t.agent &&
                      (t.status === "completed" || t.status === "cancelled") &&
                      !seen.has(t.id),
                  );
                  if (newlyFinished.length > 0) {
                    const { recordDispatch } = await getRouting();
                    for (const todo of newlyFinished) {
                      const category = AGENT_TO_CATEGORY[todo.agent] || "deep";
                      recordDispatch(directory, {
                        agent: todo.agent,
                        task_category: category,
                        success: todo.status === "completed",
                        retry_count: 0,
                        estimated_tokens: 0,
                        timestamp: new Date().toISOString(),
                      });
                      seen.add(todo.id);
                    }
                  }
                }
              } catch (e) {
                console.warn("[relentless] Failed to record dispatch outcomes:", e);
              }

              writePursuitState(directory, state);
            }
          } catch (e) {
            console.warn("[relentless] Failed to sync pursuit state:", e);
          }
        }
      } catch (e) {
        console.warn("[relentless] Event handler error:", e);
      }
    },
  };
};

export default RelentlessPlugin;
