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

function readSkill(skillName: string): string {
  const path = join(PLUGIN_ROOT, `skills/${skillName}/SKILL.md`);
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8").replace(/^---[\s\S]*?---\n/, "").trim();
}

const circuitBreakers = new Map<string, any>();
const sessionTokenUsage = new Map<string, number>();

const RelentlessPlugin: Plugin = async ({ client, directory }) => {
  const intentGateContent = readSkill("intent-gate");
  const todoEnforcerContent = readSkill("todo-enforcer");

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

  const systemInjection = [
    intentGateContent && `<RELENTLESS_INTENT_GATE>\n${intentGateContent}\n</RELENTLESS_INTENT_GATE>`,
    todoEnforcerContent && `<RELENTLESS_TODO_ENFORCER>\n${todoEnforcerContent}\n</RELENTLESS_TODO_ENFORCER>`,
    `<RELENTLESS_AGENTS>\n${agentCatalog}\n</RELENTLESS_AGENTS>`,
  ]
    .filter(Boolean)
    .join("\n\n");

  return {
    "experimental.chat.system.transform": async (_input, output) => {
      (output.system ||= []).push(systemInjection);
    },

    "experimental.session.compacting": async (_input, output) => {
      try {
        const { readPursuitState } = await getState();
        const state = readPursuitState(directory);
        if (!state) return;

        const todos = state.todos || [];
        const completed = todos.filter((t: any) => t.status === "completed");
        const pending = todos.filter((t: any) => t.status !== "completed");

        const stateContext = `
## Relentless Orchestration State (Preserved Through Compaction)
Task: ${state.task}
Progress: Loop ${state.current_loop || 1}/${state.max_loops || 10}
Completed: ${completed.length}/${todos.length} todos

Pending todos:
${pending.map((t: any) => `  [${t.status}] ${t.id}: ${t.subject}${t.agent ? ` (${t.agent})` : ""}`).join("\n") || "  (none)"}

Circuit breaker: ${state.circuit_breaker?.consecutive_failures || 0}/3 failures
Last updated: ${state.updated_at}

IMPORTANT: Continue the pursuit from the state above. Do not restart from the beginning.
`.trim();

        (output.context ||= []).push(stateContext);
      } catch {
        // Silently continue if state can't be read
      }
    },

    event: async ({ event }: { event: any }) => {
      try {
        const sessionID = event?.sessionID;
        if (!sessionID) return;

        if (event.type === "message.updated") {
          const msg = event?.properties?.info;
          if (msg?.role === "assistant" && msg?.tokens?.input) {
            const cumulative = (sessionTokenUsage.get(sessionID) || 0) + msg.tokens.input;
            sessionTokenUsage.set(sessionID, cumulative);

            const cb = circuitBreakers.get(sessionID);
            if (cb) {
              const contextLimit = msg?.model?.limit?.context || 128000;
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
                };
                writePursuitState(directory, state);
              }
            }
          } catch {
          }
        }
      } catch {
      }
    },
  };
};

export default RelentlessPlugin;
