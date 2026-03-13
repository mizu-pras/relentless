import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { join } from "path";

import {
  applyTemplate,
  findBestTemplate,
  loadTemplates,
  matchTemplates,
  parseJsonc,
  type PursuitTemplate,
} from "./templates.js";

function assert(condition: boolean, msg: string): void {
  if (!condition) throw new Error(`FAIL: ${msg}`);
}

function pass(msg: string): void {
  console.log(`PASS: ${msg}`);
}

function makeTemplate(overrides?: Partial<PursuitTemplate>): PursuitTemplate {
  return {
    name: "api-endpoint",
    description: "template",
    patterns: ["api", "endpoint", "route", "handler"],
    default_todos: [
      { id: "T-001", subject: "Define route", agent: "artisan" },
      { id: "T-002", subject: "Write tests", agent: "artisan" },
    ],
    suggested_agents: {
      "T-001": "artisan",
      "T-002": "artisan",
    },
    typical_files: ["src/**"],
    skip_brainstorming: true,
    skip_planning: false,
    ...overrides,
  };
}

function createTempDir(prefix: string): string {
  return mkdtempSync(join(tmpdir(), prefix));
}

function writeTemplate(projectDir: string, fileName: string, jsonc: string): void {
  const templatesDir = join(projectDir, "templates");
  mkdirSync(templatesDir, { recursive: true });
  writeFileSync(join(templatesDir, fileName), jsonc, "utf8");
}

try {
  const parsed = parseJsonc(`{
    // comment
    "name": "demo",
    "items": [1, 2,],
  }`);
  assert(parsed.name === "demo", "parseJsonc removes comments");
  assert(Array.isArray(parsed.items), "parseJsonc parses arrays");
  assert((parsed.items as number[]).length === 2, "parseJsonc removes trailing commas");
  pass("parseJsonc handles comments and trailing commas");

  const builtInTemplates = loadTemplates();
  assert(builtInTemplates.length >= 6, "loadTemplates loads built-in templates");
  const builtInNames = new Set(builtInTemplates.map((template) => template.name));
  assert(builtInNames.has("api-endpoint"), "built-in templates include api-endpoint");
  assert(builtInNames.has("bugfix"), "built-in templates include bugfix");
  pass("loadTemplates loads built-in templates");

  const emptyProject = createTempDir("relentless-templates-empty-");
  const originalBuiltinDir = process.env.RELENTLESS_BUILTIN_TEMPLATES_DIR;
  try {
    process.env.RELENTLESS_BUILTIN_TEMPLATES_DIR = join(emptyProject, "missing-builtins");
    const templates = loadTemplates(emptyProject);
    assert(templates.length === 0, "loadTemplates returns empty array when no templates exist");
    pass("loadTemplates returns empty array for isolated directory without templates");
  } finally {
    process.env.RELENTLESS_BUILTIN_TEMPLATES_DIR = originalBuiltinDir;
    rmSync(emptyProject, { recursive: true, force: true });
  }

  const templatesForSorting = [
    makeTemplate({
      name: "high",
      patterns: ["api", "endpoint", "route"],
    }),
    makeTemplate({
      name: "medium",
      patterns: ["api", "route", "database", "schema"],
    }),
  ];
  const sortedMatches = matchTemplates("Build API endpoint route", templatesForSorting);
  assert(sortedMatches.length === 2, "matchTemplates returns all qualifying templates");
  assert(sortedMatches[0]?.template.name === "high", "matchTemplates sorts by confidence descending");
  pass("matchTemplates returns matches sorted by confidence");

  const unrelated = matchTemplates("Design a company logo and brand voice", [makeTemplate()]);
  assert(unrelated.length === 0, "matchTemplates returns empty array for unrelated task");
  pass("matchTemplates returns empty array for unrelated task");

  const thresholdTemplates = [
    makeTemplate({ name: "below", patterns: ["api", "database", "schema", "sql"], default_todos: [] }),
    makeTemplate({ name: "above", patterns: ["api", "endpoint", "route"], default_todos: [] }),
  ];
  const thresholdMatches = matchTemplates("Add api endpoint", thresholdTemplates);
  assert(thresholdMatches.length === 1, "matchTemplates filters out confidence below 0.3");
  assert(thresholdMatches[0]?.template.name === "above", "matchTemplates keeps confidence at or above 0.3");
  pass("matchTemplates respects the 0.3 confidence threshold");

  const applied = applyTemplate(
    makeTemplate({
      default_todos: [{ id: "T-010", subject: "Do work", agent: "artisan" }],
    }),
  );
  assert(applied.length === 1, "applyTemplate creates todos");
  assert(applied[0]?.id === "T-010", "applyTemplate preserves id");
  assert(applied[0]?.subject === "Do work", "applyTemplate preserves subject");
  assert(applied[0]?.status === "pending", "applyTemplate sets pending status");
  assert(applied[0]?.agent === "artisan", "applyTemplate preserves agent");
  pass("applyTemplate converts template todos to PursuitTodo format");

  const projectWithTemplates = createTempDir("relentless-templates-best-");
  try {
    writeTemplate(
      projectWithTemplates,
      "api-endpoint.jsonc",
      JSON.stringify(
        makeTemplate({
          name: "api-endpoint",
          patterns: ["api", "endpoint", "route", "handler"],
        }),
      ),
    );
    writeTemplate(
      projectWithTemplates,
      "migration.jsonc",
      JSON.stringify(
        makeTemplate({
          name: "migration",
          patterns: ["migration", "database", "schema", "sql"],
        }),
      ),
    );
    const best = findBestTemplate("Implement API endpoint route", projectWithTemplates);
    assert(best !== null, "findBestTemplate returns match for matching task");
    assert(best?.template.name === "api-endpoint", "findBestTemplate returns highest confidence template");
    pass("findBestTemplate returns top match for matching task");

    const missing = findBestTemplate("compose poetry for launch blog", projectWithTemplates);
    assert(missing === null, "findBestTemplate returns null for non-matching task");
    pass("findBestTemplate returns null for non-matching task");

    const caseInsensitive = matchTemplates("FIX API ENDPOINT CRASH", [
      makeTemplate({
        patterns: ["api", "endpoint", "fix", "crash"],
      }),
    ]);
    assert(caseInsensitive.length === 1, "matchTemplates is case-insensitive");
    pass("Template matching is case-insensitive");
  } finally {
    rmSync(projectWithTemplates, { recursive: true, force: true });
  }

  console.log("All template tests passed.");
} catch (error) {
  console.error(error);
  process.exitCode = 1;
}
