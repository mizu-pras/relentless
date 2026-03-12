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
  if (!resolved.startsWith(PLUGIN_ROOT)) return ""; // path traversal guard
  if (!existsSync(resolved)) return "";
  return readFileSync(resolved, "utf8").replace(/^---[\s\S]*?---\n/, "").trim();
}

const circuitBreakers = new Map<string, any>();
const sessionTokenUsage = new Map<string, number>();
const sessionContextLimits = new Map<string, number>();

const RelentlessPlugin: Plugin = async ({ client, directory }) => {
  const intentGateContent = readSkill("intent-gate");
  const todoEnforcerContent = readSkill("todo-enforcer");
  const usingRelentlessContent = readSkill("using-relentless");
  const usingRelentlessExtended = readSkill("using-relentless", "SKILL-EXTENDED");
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
    "experimental.chat.system.transform": async (_input, output) => {
      const parts: string[] = [];

      if (usingRelentlessContent) {
        parts.push(`<RELENTLESS_BOOTSTRAP>\n## Using Relentless\n\n${usingRelentlessContent}\n</RELENTLESS_BOOTSTRAP>`);
      }
      parts.push(`<RELENTLESS_AGENTS>\n${agentCatalog}\n</RELENTLESS_AGENTS>`);

      try {
        const { readPursuitState } = await getState();
        const state = readPursuitState(directory);
        if (state) {
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

      (output.system ||= []).push(parts.join("\n\n"));
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
                writePursuitState(directory, state);
              }
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
