import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "../..");

// Lazy imports for lib modules (avoid top-level failures if not yet created)
async function getState() {
  const { readPursuitState, writePursuitState, isHalted, formatStatus } =
    await import(join(PLUGIN_ROOT, "lib/state.js"));
  return { readPursuitState, writePursuitState, isHalted, formatStatus };
}

async function getCircuitBreaker() {
  const { CircuitBreaker } = await import(join(PLUGIN_ROOT, "lib/circuit-breaker.js"));
  return CircuitBreaker;
}

async function getConfig(dir) {
  const { loadConfig } = await import(join(PLUGIN_ROOT, "lib/config.js"));
  return loadConfig(dir);
}

/**
 * Read SKILL.md content, stripping frontmatter.
 */
function readSkill(skillName) {
  const path = join(PLUGIN_ROOT, `skills/${skillName}/SKILL.md`);
  if (!existsSync(path)) return "";
  return readFileSync(path, "utf8").replace(/^---[\s\S]*?---\n/, "").trim();
}

// Per-session circuit breaker instances (keyed by sessionID)
const circuitBreakers = new Map();

// Per-session cumulative input token tracking (keyed by sessionID)
const sessionTokenUsage = new Map();

/**
 * Relentless Plugin for OpenCode
 */
export default async function RelentlessPlugin({ client, directory }) {
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
    // Inject IntentGate + Todo Enforcer + agent catalog into system prompt
    "experimental.chat.system.transform": async (input, output) => {
      (output.system ||= []).push(systemInjection);
    },

    // Preserve orchestration state during session compaction
    "experimental.session.compacting": async (input, output) => {
      try {
        const { readPursuitState } = await getState();
        const state = readPursuitState(directory);
        if (!state) return;

        const todos = state.todos || [];
        const completed = todos.filter((t) => t.status === "completed");
        const pending = todos.filter((t) => t.status !== "completed");

        const stateContext = `
## Relentless Orchestration State (Preserved Through Compaction)
Task: ${state.task}
Progress: Loop ${state.current_loop || 1}/${state.max_loops || 10}
Completed: ${completed.length}/${todos.length} todos

Pending todos:
${pending.map((t) => `  [${t.status}] ${t.id}: ${t.subject}${t.agent ? ` (${t.agent})` : ""}`).join("\n") || "  (none)"}

Circuit breaker: ${state.circuit_breaker?.consecutive_failures || 0}/3 failures
Last updated: ${state.updated_at}

IMPORTANT: Continue the pursuit from the state above. Do not restart from the beginning.
`.trim();

        (output.context ||= []).push(stateContext);
      } catch (e) {
        // Silently continue if state can't be read
      }
    },

    // Track session events for circuit breaker + token budget (Layer 4)
    event: async (event) => {
      try {
        const sessionID = event?.sessionID;
        if (!sessionID) return;

        // Layer 4: Track token usage from message updates
        if (event.type === "message.updated") {
          const msg = event?.properties?.info;
          if (msg?.role === "assistant" && msg?.tokens?.input) {
            const cumulative = (sessionTokenUsage.get(sessionID) || 0) + msg.tokens.input;
            sessionTokenUsage.set(sessionID, cumulative);

            // Check token budget if we have a circuit breaker for this session
            const cb = circuitBreakers.get(sessionID);
            if (cb) {
              // Get model context limit (default 128k if unknown)
              const contextLimit = msg?.model?.limit?.context || 128000;
              const usage = cumulative / contextLimit;
              if (!cb.checkTokenBudget(usage)) {
                cb.markStalled();
                // State will be persisted on next idle event
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
          // Snapshot state on session idle
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
            // Silently continue
          }
        }
      } catch {
        // Event handling errors should never crash the plugin
      }
    },
  };
}
