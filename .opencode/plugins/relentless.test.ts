import assert from "assert";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { fileURLToPath, pathToFileURL } from "url";

import RelentlessPlugin from "./relentless.js";
import { writePursuitState, readPursuitState } from "../../lib/dist/state.js";
import { writeMarkdownContext } from "../../lib/dist/shared-context.js";
import { writeLessons } from "../../lib/dist/lessons.js";

function createTempDir(): string {
  return mkdtempSync(join(tmpdir(), "relentless-plugin-test-"));
}

function cleanupDir(dir: string): void {
  rmSync(dir, { recursive: true, force: true });
}

function stripFrontmatter(content: string): string {
  return content.replace(/^---[\s\S]*?---\n/, "").trim();
}

function commandTemplate(command: string, args: string): string {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const source = readFileSync(join(root, "commands", `${command}.md`), "utf8");
  return stripFrontmatter(source).replace(/\$ARGUMENTS/g, args);
}

async function loadPrivateHelpers(): Promise<{
  readSkill: (name: string, variant?: string) => string;
  readCommandFile: (name: string, args: string) => string | null;
  readAgentModel: (name: string) => string;
}> {
  const here = dirname(fileURLToPath(import.meta.url));
  const pluginPath = join(here, "relentless.js");
  const source = readFileSync(pluginPath, "utf8");
  const instrumentedPath = join(here, `relentless.instrumented-${Date.now()}.mjs`);
  writeFileSync(
    instrumentedPath,
    `${source}\nexport { readSkill, readCommandFile, readAgentModel };\n`,
    "utf8",
  );
  try {
    const loaded = (await import(pathToFileURL(instrumentedPath).href + `?t=${Date.now()}`)) as {
      readSkill: (name: string, variant?: string) => string;
      readCommandFile: (name: string, args: string) => string | null;
      readAgentModel: (name: string) => string;
    };
    return loaded;
  } finally {
    rmSync(instrumentedPath, { force: true });
  }
}

async function run(): Promise<void> {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const conductorAgent = readFileSync(join(root, "agents", "conductor.md"), "utf8");
  const expectedModel = conductorAgent.match(/^model:\s*(.+)$/m)?.[1]?.trim() || "";

  {
    const dir = createTempDir();
    const plugin = (await RelentlessPlugin({ client: {}, directory: dir } as any)) as any;
    const input: any = {};
    await plugin.config(input);
    assert.strictEqual(input.agent.general.model, expectedModel, "config hook should set conductor model");
    console.log("PASS: config hook sets general agent model from conductor frontmatter");
    cleanupDir(dir);
  }

  {
    const dir = createTempDir();
    const plugin = (await RelentlessPlugin({ client: {}, directory: dir } as any)) as any;

    const outputRewrite: any = { parts: [{ type: "text", text: "unleash - build API" }] };
    await plugin["chat.message"]({}, outputRewrite);
    assert.strictEqual(
      outputRewrite.parts[0].text,
      commandTemplate("unleash", "build API"),
      "chat.message should rewrite slash-free unleash command",
    );

    const outputIgnore: any = { parts: [{ type: "text", text: "hello world" }] };
    await plugin["chat.message"]({}, outputIgnore);
    assert.strictEqual(outputIgnore.parts[0].text, "hello world", "chat.message should ignore non-command text");

    const outputHalt: any = { parts: [{ type: "text", text: "halt" }] };
    await plugin["chat.message"]({}, outputHalt);
    assert.strictEqual(
      outputHalt.parts[0].text,
      commandTemplate("halt", ""),
      "chat.message should rewrite halt without arguments",
    );
    console.log("PASS: chat.message rewrites slash-free commands and ignores non-command messages");

    cleanupDir(dir);
  }

  {
    const dir = createTempDir();
    const plugin = (await RelentlessPlugin({ client: {}, directory: dir } as any)) as any;
    const output: any = { system: [] };
    await plugin["experimental.chat.system.transform"]({}, output);
    const injected = output.system.join("\n");

    assert.ok(injected.includes("<RELENTLESS_BOOTSTRAP>"), "should always inject bootstrap context");
    assert.ok(!injected.includes("<RELENTLESS_AGENTS>"), "should not inject heavy context without pursuit state");
    assert.ok(!injected.includes("<RELENTLESS_INTENT_GATE>"), "should not inject intent gate without pursuit state");
    assert.ok(!injected.includes("<RELENTLESS_TODO_ENFORCER>"), "should not inject todo enforcer without pursuit state");
    console.log("PASS: system transform injects bootstrap and skips heavy context when no state exists");

    cleanupDir(dir);
  }

  {
    const dir = createTempDir();
    writePursuitState(dir, {
      task: "Test pursuit",
      todos: [{ id: "T-001", subject: "Implement", status: "in_progress", agent: "artisan" }],
      current_loop: 1,
      max_loops: 5,
    });

    writeLessons(dir, [
      {
        id: "L-00000001",
        category: "pattern",
        pattern: "Prefer explicit checks",
        resolution: "Validate inputs before side effects",
        frequency: 1,
        agents: ["sentinel"],
        examples: ["guard against undefined"],
        first_seen: new Date().toISOString(),
        last_seen: new Date().toISOString(),
        source_files: ["lib/state.ts"],
      },
    ]);

    const plugin = (await RelentlessPlugin({ client: {}, directory: dir } as any)) as any;
    const output: any = { system: [] };
    await plugin["experimental.chat.system.transform"]({}, output);
    const injected = output.system.join("\n");

    assert.ok(injected.includes("<RELENTLESS_BOOTSTRAP>"), "should keep bootstrap with active state");
    assert.ok(injected.includes("<RELENTLESS_AGENTS>"), "should inject agent catalog when pursuit exists");
    assert.ok(injected.includes("<RELENTLESS_SKILL_DISCIPLINE>"), "should inject extended skill discipline");
    assert.ok(injected.includes("<RELENTLESS_INTENT_GATE>"), "should inject intent-gate in active pursuit");
    assert.ok(injected.includes("<RELENTLESS_TODO_ENFORCER>"), "should inject todo-enforcer in active pursuit");
    assert.ok(injected.includes("<RELENTLESS_LESSONS>"), "should inject persisted lessons");
    console.log("PASS: system transform injects heavy context and lessons when pursuit state is active");

    cleanupDir(dir);
  }

  {
    const dir = createTempDir();
    const lessonsPath = join(dir, ".relentless", "lessons.jsonl");
    mkdirSync(join(dir, ".relentless"), { recursive: true });
    writeFileSync(lessonsPath, "{not-json}\n", "utf8");

    const plugin = (await RelentlessPlugin({ client: {}, directory: dir } as any)) as any;
    const output: any = { system: [] };
    await plugin["experimental.chat.system.transform"]({}, output);
    const injected = output.system.join("\n");

    assert.ok(injected.includes("<RELENTLESS_BOOTSTRAP>"), "corrupted lessons should not block bootstrap");
    assert.ok(!injected.includes("<RELENTLESS_LESSONS>"), "corrupted lessons JSONL should be ignored safely");
    console.log("PASS: system transform tolerates corrupted lessons JSONL");

    cleanupDir(dir);
  }

  {
    const dir = createTempDir();
    const baseState = {
      task: "Compaction test",
      todos: [
        { id: "T-001", subject: "Start", status: "completed" },
        { id: "T-002", subject: "Continue", status: "pending" },
      ],
      current_loop: 1,
      max_loops: 4,
      updated_at: new Date().toISOString(),
      circuit_breaker: { consecutive_failures: 0 },
      config: { circuit_breaker: { max_consecutive_failures: 3 } },
    };

    writePursuitState(dir, baseState as any);
    writeMarkdownContext(dir, "project-map", "Compaction context project map");

    const plugin = (await RelentlessPlugin({ client: {}, directory: dir } as any)) as any;
    const first: any = { context: [] };
    await plugin["experimental.session.compacting"]({}, first);
    const firstCtx = first.context.join("\n");

    assert.ok(firstCtx.includes("Relentless Orchestration State"), "first compaction should preserve state context");
    assert.ok(firstCtx.includes("## Shared Context"), "compaction should include shared context");

    writePursuitState(dir, {
      ...baseState,
      current_loop: 2,
      todos: [
        { id: "T-001", subject: "Start", status: "completed" },
        { id: "T-002", subject: "Continue", status: "completed" },
      ],
    } as any);

    const second: any = { context: [] };
    await plugin["experimental.session.compacting"]({}, second);
    const secondCtx = second.context.join("\n");
    assert.ok(secondCtx.includes("Relentless State Update"), "second compaction should use differential output");
    console.log("PASS: session compaction preserves state, performs differential updates, and includes shared context");

    cleanupDir(dir);
  }

  {
    const dir = createTempDir();
    const state = writePursuitState(dir, {
      task: "Fallback compaction",
      todos: [{ id: "T-001", subject: "Only task", status: "pending" }],
      current_loop: 1,
      max_loops: 2,
      config: { circuit_breaker: { max_consecutive_failures: 3 } },
    });
    assert.ok(state, "state should be written before fallback test");

    const stateDir = join(dir, ".relentless");
    chmodSync(stateDir, 0o500);

    try {
      const plugin = (await RelentlessPlugin({ client: {}, directory: dir } as any)) as any;
      const output: any = { context: [] };
      await plugin["experimental.session.compacting"]({}, output);
      const compacted = output.context.join("\n");

      assert.ok(compacted.includes("Compaction Fallback"), "compaction should fall back if snapshot save fails");
      console.log("PASS: session compaction falls back gracefully on compaction failure");
    } finally {
      chmodSync(stateDir, 0o700);
      cleanupDir(dir);
    }
  }

  {
    const dir = createTempDir();
    writePursuitState(dir, {
      task: "Event sync",
      todos: [{ id: "T-001", subject: "Track", status: "in_progress" }],
      current_loop: 1,
      max_loops: 3,
      config: { circuit_breaker: { max_consecutive_failures: 3 } },
    });

    const plugin = (await RelentlessPlugin({ client: {}, directory: dir } as any)) as any;

    await plugin.event({
      event: {
        type: "session.error",
        sessionID: "s-1",
        error: new Error("rate limit"),
      },
    });

    await plugin.event({
      event: {
        type: "message.updated",
        sessionID: "s-1",
        properties: {
          info: {
            role: "assistant",
            tokens: { input: 100, output: 20 },
            model: { limit: { context: 1000 } },
          },
        },
      },
    });

    await plugin.event({ event: { type: "session.idle", sessionID: "s-1" } });

    const synced = readPursuitState(dir) as any;
    assert.ok(synced?.circuit_breaker, "session.idle should sync circuit breaker state into pursuit snapshot");
    assert.strictEqual(synced.circuit_breaker.token_usage, 120, "should accumulate token usage from message.updated");
    assert.strictEqual(synced.circuit_breaker.context_limit, 1000, "should persist observed context limit");
    assert.ok(synced.circuit_breaker.consecutive_failures >= 1, "session.error should record failures");
    console.log("PASS: event handler tracks tokens, records failures, and syncs state on idle");

    cleanupDir(dir);
  }

  // Circuit breaker integration: token budget triggers stall
  {
    const dir = createTempDir();
    writePursuitState(dir, {
      task: "Token budget test",
      todos: [{ id: "T-001", subject: "Budget", status: "in_progress" }],
      current_loop: 1,
      max_loops: 3,
      config: { circuit_breaker: { max_consecutive_failures: 3 } },
    });

    const plugin = (await RelentlessPlugin({ client: {}, directory: dir } as any)) as any;
    const sessionID = "s-budget";

    // First, trigger a session.error to initialize the circuit breaker for this session
    await plugin.event({
      event: { type: "session.error", sessionID, error: new Error("network") },
    });

    // Send token usage that exceeds 85% of context limit (e.g. 900/1000 = 90%)
    await plugin.event({
      event: {
        type: "message.updated",
        sessionID,
        properties: {
          info: {
            role: "assistant",
            tokens: { input: 850, output: 50 },
            model: { limit: { context: 1000 } },
          },
        },
      },
    });

    // Sync state to capture circuit breaker status
    await plugin.event({ event: { type: "session.idle", sessionID } });

    const synced = readPursuitState(dir) as any;
    assert.ok(synced?.circuit_breaker, "circuit breaker state should be synced");
    assert.ok(synced.circuit_breaker.stalled === true, "token budget exceeding 85% should trigger stall");
    console.log("PASS: circuit breaker token budget triggers stall when usage exceeds threshold");

    cleanupDir(dir);
  }

  {
    const helpers = await loadPrivateHelpers();
    assert.strictEqual(helpers.readSkill("../../etc/passwd"), "", "readSkill should block path traversal");
    assert.strictEqual(
      helpers.readCommandFile("../../etc/passwd", "irrelevant"),
      null,
      "readCommandFile should block path traversal",
    );
    assert.strictEqual(helpers.readAgentModel("../../etc/passwd"), "", "readAgentModel should block path traversal");

    assert.strictEqual(helpers.readSkill("does-not-exist"), "", "missing skill should return empty string");
    assert.strictEqual(helpers.readCommandFile("does-not-exist", ""), null, "missing command should return null");
    assert.strictEqual(helpers.readAgentModel("does-not-exist"), "", "missing agent model should return empty string");
    console.log("PASS: helper readers enforce path traversal guards and missing-file edge cases");
  }

  console.log("All relentless plugin integration tests passed.");
}

await run();
