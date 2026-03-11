import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PLUGIN_ROOT = join(__dirname, "../..");

/**
 * Relentless Plugin for OpenCode
 * Autonomous multi-agent orchestration on top of superpowers.
 */
export default async function RelentlessPlugin({ client, directory }) {
  // Load IntentGate + Todo Enforcer content for system prompt injection
  const intentGatePath = join(PLUGIN_ROOT, "skills/intent-gate/SKILL.md");
  const todoEnforcerPath = join(PLUGIN_ROOT, "skills/todo-enforcer/SKILL.md");

  const intentGateContent = existsSync(intentGatePath)
    ? readFileSync(intentGatePath, "utf8").replace(/^---[\s\S]*?---\n/, "")
    : "";
  const todoEnforcerContent = existsSync(todoEnforcerPath)
    ? readFileSync(todoEnforcerPath, "utf8").replace(/^---[\s\S]*?---\n/, "")
    : "";

  const agentCatalog = `
## Relentless Agent Catalog

You have access to these specialized agents:
- **conductor** (Claude Opus): Orchestrator. Plans, delegates, validates. Use for /unleash.
- **artisan** (GPT-5.3 Codex): Deep coder. Complex implementation, backend, refactoring.
- **maestro** (GPT-5.3 Codex): UI/UX specialist. Visual/aesthetic-primary tasks.
- **sentinel** (Claude Sonnet): Debugger and architect. Root cause tracing, code review.
- **scout** (GLM-5): Fast explorer. Read-only codebase recon, file search.

Authority hierarchy: conductor > sentinel > artisan/maestro > scout
`;

  const systemInjection = `
<RELENTLESS>
${intentGateContent}

${todoEnforcerContent}

${agentCatalog}
</RELENTLESS>
`;

  return {
    "experimental.chat.system.transform": async (input, output) => {
      (output.system ||= []).push(systemInjection);
    },
  };
}
