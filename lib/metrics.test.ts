import assert from "assert";
import { mkdirSync, rmSync, writeFileSync } from "fs";
import { join } from "path";
import { computeMetrics, formatMetricsSummary, formatMetricsDetailed } from "./metrics.js";

function makeTestDir(name: string): string {
  const dir = `/tmp/relentless-metrics-${name}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  mkdirSync(dir, { recursive: true });
  return dir;
}

function writeArchive(projectDir: string, fileName: string, payload: unknown): void {
  const historyDir = join(projectDir, ".relentless", "history");
  mkdirSync(historyDir, { recursive: true });
  writeFileSync(join(historyDir, fileName), JSON.stringify(payload, null, 2), "utf8");
}

function writeLessons(projectDir: string, lessons: unknown[]): void {
  const stateDir = join(projectDir, ".relentless");
  mkdirSync(stateDir, { recursive: true });
  writeFileSync(join(stateDir, "lessons.jsonl"), lessons.map((entry) => JSON.stringify(entry)).join("\n") + "\n", "utf8");
}

{
  const testDir = makeTestDir("no-history");
  const metrics = computeMetrics(testDir);
  assert.strictEqual(metrics.pursuit.total_pursuits, 0, "should default total pursuits to zero");
  assert.strictEqual(metrics.pursuit.completed_pursuits, 0, "should default completed pursuits to zero");
  assert.strictEqual(metrics.pursuit.completion_rate, 0, "should default completion rate to zero");
  assert.strictEqual(metrics.pursuit.avg_todos_per_pursuit, 0, "should default average todos to zero");
  assert.strictEqual(metrics.pursuit.total_todos, 0, "should default total todos to zero");
  assert.strictEqual(metrics.pursuit.total_completed_todos, 0, "should default completed todos to zero");
  assert.deepStrictEqual(metrics.agents, [], "should default agent metrics to empty");
  assert.strictEqual(metrics.errors.total_errors, 0, "should default errors to zero");
  assert.strictEqual(metrics.errors.resolved_count, 0, "should default resolved errors to zero");
  assert.deepStrictEqual(metrics.errors.top_categories, [], "should default top categories to empty");
  assert.deepStrictEqual(
    metrics.cost,
    {
      total_estimated: 0,
      total_actual: 0,
      avg_estimated_per_pursuit: 0,
      avg_actual_per_pursuit: 0,
      agent_costs: [],
    },
    "should default cost metrics to zero values"
  );
  rmSync(testDir, { recursive: true, force: true });
  console.log("PASS: computeMetrics returns zero metrics when no history exists");
}

{
  const testDir = makeTestDir("pursuit-metrics");
  writeArchive(testDir, "2026-03-12-task-a.json", {
    task: "task a",
    todos: [
      { id: "T-1", subject: "a", status: "completed", agent: "artisan" },
      { id: "T-2", subject: "b", status: "completed", agent: "artisan" },
    ],
    archived_at: "2026-03-12T10:00:00.000Z",
  });
  writeArchive(testDir, "2026-03-13-task-b.json", {
    task: "task b",
    todos: [
      { id: "T-3", subject: "c", status: "completed", agent: "sentinel" },
      { id: "T-4", subject: "d", status: "pending", agent: "sentinel" },
      { id: "T-5", subject: "e", status: "pending", agent: "artisan" },
    ],
    archived_at: "2026-03-13T10:00:00.000Z",
  });

  const metrics = computeMetrics(testDir);
  assert.strictEqual(metrics.pursuit.total_pursuits, 2, "should count pursuits from archives");
  assert.strictEqual(metrics.pursuit.completed_pursuits, 1, "should count pursuits with all todos complete");
  assert.strictEqual(metrics.pursuit.completion_rate, 50, "should compute completion rate percentage");
  assert.strictEqual(metrics.pursuit.total_todos, 5, "should count total todos");
  assert.strictEqual(metrics.pursuit.total_completed_todos, 3, "should count completed todos");
  assert.strictEqual(metrics.pursuit.avg_todos_per_pursuit, 2.5, "should compute average todos per pursuit");
  assert.strictEqual(metrics.cost.total_estimated, 0, "missing token tracking should produce zero estimated costs");
  assert.strictEqual(metrics.cost.total_actual, 0, "missing token tracking should produce zero actual costs");
  rmSync(testDir, { recursive: true, force: true });
  console.log("PASS: computeMetrics computes pursuit metrics from fixture archives");
}

{
  const testDir = makeTestDir("agent-metrics");
  writeArchive(testDir, "2026-03-12-task-a.json", {
    task: "task a",
    todos: [
      { id: "T-1", subject: "a", status: "completed", agent: "artisan" },
      { id: "T-2", subject: "b", status: "pending", agent: "artisan" },
      { id: "T-3", subject: "c", status: "completed", agent: "sentinel" },
      { id: "T-4", subject: "d", status: "completed", agent: "scout" },
      { id: "T-5", subject: "e", status: "pending", agent: "scout" },
      { id: "T-6", subject: "f", status: "pending" },
    ],
    archived_at: "2026-03-12T10:00:00.000Z",
  });

  const metrics = computeMetrics(testDir);
  const artisan = metrics.agents.find((entry: { agent: string }) => entry.agent === "artisan");
  const sentinel = metrics.agents.find((entry: { agent: string }) => entry.agent === "sentinel");
  const scout = metrics.agents.find((entry: { agent: string }) => entry.agent === "scout");

  assert.ok(artisan, "should include artisan metrics");
  assert.ok(sentinel, "should include sentinel metrics");
  assert.ok(scout, "should include scout metrics");
  assert.strictEqual(artisan?.dispatch_count, 2, "artisan dispatch count should match assigned todos");
  assert.strictEqual(artisan?.completed_count, 1, "artisan completion count should match completed todos");
  assert.strictEqual(artisan?.success_rate, 50, "artisan success rate should be completed/dispatch");
  assert.strictEqual(sentinel?.success_rate, 100, "single completed assignment should be 100% success");
  assert.strictEqual(scout?.success_rate, 50, "partial completion should calculate success rate");
  rmSync(testDir, { recursive: true, force: true });
  console.log("PASS: computeMetrics computes agent metrics from todo assignments");
}

{
  const testDir = makeTestDir("error-metrics");
  writeLessons(testDir, [
    {
      id: "L-1",
      category: "type_error",
      pattern: "a",
      resolution: "fixed",
      frequency: 3,
      agents: ["artisan"],
      examples: ["a"],
      source_files: ["lib/a.ts"],
      first_seen: "2026-03-11T00:00:00.000Z",
      last_seen: "2026-03-11T00:00:00.000Z",
    },
    {
      id: "L-2",
      category: "type_error",
      pattern: "b",
      resolution: "",
      frequency: 1,
      agents: ["artisan"],
      examples: ["b"],
      source_files: ["lib/b.ts"],
      first_seen: "2026-03-11T00:00:00.000Z",
      last_seen: "2026-03-11T00:00:00.000Z",
    },
    {
      id: "L-3",
      category: "import_error",
      pattern: "c",
      resolution: "fixed",
      frequency: 2,
      agents: ["sentinel"],
      examples: ["c"],
      source_files: ["lib/c.ts"],
      first_seen: "2026-03-11T00:00:00.000Z",
      last_seen: "2026-03-11T00:00:00.000Z",
    },
  ]);

  const metrics = computeMetrics(testDir);
  assert.strictEqual(metrics.errors.total_errors, 3, "should count lessons as total errors");
  assert.strictEqual(metrics.errors.resolved_count, 2, "should count lessons with non-empty resolution");
  assert.deepStrictEqual(
    metrics.errors.top_categories,
    [
      { category: "type_error", count: 2 },
      { category: "import_error", count: 1 },
    ],
    "should group lessons by category",
  );
  rmSync(testDir, { recursive: true, force: true });
  console.log("PASS: computeMetrics computes error metrics from lessons");
}

{
  const testDir = makeTestDir("corrupted-archives");
  writeArchive(testDir, "2026-03-12-valid.json", {
    task: "valid",
    todos: [{ id: "T-1", subject: "a", status: "completed", agent: "artisan" }],
    archived_at: "2026-03-12T10:00:00.000Z",
  });
  const historyDir = join(testDir, ".relentless", "history");
  writeFileSync(join(historyDir, "2026-03-13-bad.json"), "{not valid json", "utf8");

  const metrics = computeMetrics(testDir);
  assert.strictEqual(metrics.pursuit.total_pursuits, 1, "should skip corrupted archives and keep valid ones");
  assert.strictEqual(metrics.pursuit.total_todos, 1, "should only count todos from valid archives");
  rmSync(testDir, { recursive: true, force: true });
  console.log("PASS: computeMetrics handles corrupted archive files gracefully");
}

{
  const testDir = makeTestDir("summary-format");
  writeArchive(testDir, "2026-03-12-task-a.json", {
    task: "task a",
    todos: [{ id: "T-1", subject: "a", status: "completed", agent: "artisan" }],
    archived_at: "2026-03-12T10:00:00.000Z",
  });
  writeLessons(testDir, [
    {
      id: "L-1",
      category: "type_error",
      pattern: "a",
      resolution: "fixed",
      frequency: 1,
      agents: ["artisan"],
      examples: ["a"],
      source_files: ["lib/a.ts"],
      first_seen: "2026-03-11T00:00:00.000Z",
      last_seen: "2026-03-11T00:00:00.000Z",
    },
  ]);

  const output = formatMetricsSummary(computeMetrics(testDir));
  assert.ok(output.includes("## Pursuit Analytics"), "summary should include analytics header");
  assert.ok(output.includes("## Agent Performance"), "summary should include agent section");
  assert.ok(output.includes("## Error Patterns"), "summary should include error section");
  assert.ok(output.includes("## Cost Tracking"), "summary should include cost tracking section");
  rmSync(testDir, { recursive: true, force: true });
  console.log("PASS: formatMetricsSummary returns human-readable output");
}

{
  const testDir = makeTestDir("detailed-format");
  writeArchive(testDir, "2026-03-12-task-a.json", {
    task: "task a",
    todos: [
      { id: "T-1", subject: "a", status: "completed", agent: "artisan" },
      { id: "T-2", subject: "b", status: "pending", agent: "artisan" },
    ],
    archived_at: "2026-03-12T10:00:00.000Z",
  });

  const output = formatMetricsDetailed(computeMetrics(testDir));
  assert.ok(output.includes("Generated:"), "detailed output should include generation timestamp");
  assert.ok(output.includes("Pursuit Metrics"), "detailed output should include pursuit metrics section");
  assert.ok(output.includes("Agent Metrics"), "detailed output should include agent metrics section");
  assert.ok(output.includes("Error Metrics"), "detailed output should include error metrics section");
  assert.ok(output.includes("Cost Metrics"), "detailed output should include cost metrics section");
  rmSync(testDir, { recursive: true, force: true });
  console.log("PASS: formatMetricsDetailed returns detailed breakdown");
}

{
  const testDir = makeTestDir("no-todos");
  writeArchive(testDir, "2026-03-12-task-a.json", {
    task: "task a",
    todos: [],
    archived_at: "2026-03-12T10:00:00.000Z",
  });

  const metrics = computeMetrics(testDir);
  assert.strictEqual(metrics.pursuit.total_todos, 0, "pursuit with no todos should not increase todo count");
  assert.strictEqual(metrics.pursuit.completed_pursuits, 1, "pursuit with no todos should count as completed");
  assert.strictEqual(metrics.pursuit.completion_rate, 100, "single completed pursuit should yield 100% completion");
  rmSync(testDir, { recursive: true, force: true });
  console.log("PASS: computeMetrics handles pursuits with no todos");
}

{
  const testDir = makeTestDir("todos-without-agent");
  writeArchive(testDir, "2026-03-12-task-a.json", {
    task: "task a",
    todos: [
      { id: "T-1", subject: "a", status: "completed" },
      { id: "T-2", subject: "b", status: "pending" },
    ],
    archived_at: "2026-03-12T10:00:00.000Z",
  });

  const metrics = computeMetrics(testDir);
  assert.deepStrictEqual(metrics.agents, [], "todos without agent should be excluded from agent metrics");
  rmSync(testDir, { recursive: true, force: true });
  console.log("PASS: computeMetrics handles todos without agent field");
}

{
  const testDir = makeTestDir("non-array-todos");
  writeArchive(testDir, "2026-03-12-task-a.json", {
    task: "task a",
    todos: "corrupted-not-an-array",
    archived_at: "2026-03-12T10:00:00.000Z",
  });

  const metrics = computeMetrics(testDir);
  assert.strictEqual(metrics.pursuit.total_pursuits, 1, "non-array todos should not crash");
  assert.strictEqual(metrics.pursuit.total_todos, 0, "non-array todos should contribute zero todos");
  assert.strictEqual(metrics.pursuit.completed_pursuits, 1, "pursuit with non-array todos vacuously counts as completed");
  rmSync(testDir, { recursive: true, force: true });
  console.log("PASS: computeMetrics handles non-array todos field gracefully");
}

{
  const testDir = makeTestDir("cost-metrics");
  writeArchive(testDir, "2026-03-12-task-a.json", {
    task: "task a",
    todos: [{ id: "T-1", subject: "a", status: "completed", agent: "artisan" }],
    token_tracking: {
      dispatches: [
        {
          agent: "artisan",
          task_id: "T-1",
          estimated_tokens: 5000,
          actual_tokens: 4800,
          timestamp: "2026-03-12T10:00:00.000Z",
        },
        {
          agent: "sentinel",
          task_id: "T-2",
          estimated_tokens: 3500,
          actual_tokens: 4000,
          timestamp: "2026-03-12T10:05:00.000Z",
        },
      ],
      total_estimated: 8500,
      total_actual: 8800,
    },
    archived_at: "2026-03-12T10:10:00.000Z",
  });
  writeArchive(testDir, "2026-03-13-task-b.json", {
    task: "task b",
    todos: [{ id: "T-3", subject: "b", status: "completed", agent: "artisan" }],
    token_tracking: {
      dispatches: [
        {
          agent: "artisan",
          task_id: "T-3",
          estimated_tokens: 2000,
          actual_tokens: 2100,
          timestamp: "2026-03-13T11:00:00.000Z",
        },
      ],
      total_estimated: 2000,
      total_actual: 2100,
    },
    archived_at: "2026-03-13T11:10:00.000Z",
  });

  const metrics = computeMetrics(testDir);
  assert.strictEqual(metrics.cost.total_estimated, 10500, "should aggregate estimated tokens across archives");
  assert.strictEqual(metrics.cost.total_actual, 10900, "should aggregate actual tokens across archives");
  assert.strictEqual(metrics.cost.avg_estimated_per_pursuit, 5250, "should compute avg estimated cost per pursuit");
  assert.strictEqual(metrics.cost.avg_actual_per_pursuit, 5450, "should compute avg actual cost per pursuit");
  assert.deepStrictEqual(
    metrics.cost.agent_costs,
    [
      { agent: "artisan", estimated: 7000, actual: 6900, dispatches: 2 },
      { agent: "sentinel", estimated: 3500, actual: 4000, dispatches: 1 },
    ],
    "should aggregate per-agent dispatch costs across archives"
  );
  rmSync(testDir, { recursive: true, force: true });
  console.log("PASS: computeMetrics aggregates token tracking cost metrics");
}

console.log("All metrics tests passed.");
