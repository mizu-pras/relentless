import {
  readLessons,
  writeLessons,
  clearLessons,
  categorizeError,
  normalizePattern,
  generateLessonId,
  extractLessons,
  formatLessonsForContext,
  formatLessonsForHandoff,
  getGotchasForStack,
  Lesson,
  LessonCategory,
} from "./lessons.js";
import { mkdirSync, rmSync, existsSync } from "fs";
import { join } from "path";
import assert from "assert";

const TEST_DIR = "/tmp/relentless-lessons-test-" + Date.now();
mkdirSync(TEST_DIR, { recursive: true });

function makeLesson(
  id: string,
  category: LessonCategory,
  pattern: string,
  resolution: string,
  frequency: number,
  file: string,
  lastSeen: string,
): Lesson {
  return {
    id,
    category,
    pattern,
    resolution,
    frequency,
    agents: ["artisan"],
    examples: [pattern],
    first_seen: "2026-03-12T00:00:00.000Z",
    last_seen: lastSeen,
    source_files: [file],
  };
}

const missingDir = join(TEST_DIR, "missing");
assert.deepStrictEqual(readLessons(missingDir), [], "should return empty lessons when file does not exist");
console.log("PASS: readLessons returns empty array for nonexistent storage");

const ioDir = join(TEST_DIR, "io");
const lessonA = makeLesson("L-a0000001", "build_error", "Build failed", "Fix tsconfig", 1, "lib/a.ts", "2026-03-12T00:01:00.000Z");
const lessonB = makeLesson("L-b0000002", "type_error", "Type mismatch", "Use proper types", 5, "lib/b.ts", "2026-03-12T00:02:00.000Z");
const lessonC = makeLesson("L-c0000003", "import_error", "Cannot find module", "Fix import path", 3, "lib/c.ts", "2026-03-12T00:03:00.000Z");

writeLessons(ioDir, [lessonA, lessonB, lessonC]);
const roundTrip = readLessons(ioDir);
assert.strictEqual(roundTrip.length, 3, "should persist and read all lessons");
assert.strictEqual(roundTrip[0].id, lessonB.id, "should sort lessons by frequency DESC");
assert.strictEqual(roundTrip[1].id, lessonC.id, "should preserve descending order");
assert.strictEqual(roundTrip[2].id, lessonA.id, "should place lowest frequency last");
console.log("PASS: writeLessons/readLessons round-trip with frequency sort");

const maxTwo = readLessons(ioDir, 2);
assert.strictEqual(maxTwo.length, 2, "maxEntries should limit returned results");
assert.strictEqual(maxTwo[0].id, lessonB.id, "maxEntries should return highest-frequency lesson first");
assert.strictEqual(maxTwo[1].id, lessonC.id, "maxEntries should return second-highest-frequency lesson");
console.log("PASS: readLessons maxEntries returns top-N by frequency");

const emptyDir = join(TEST_DIR, "empty");
writeLessons(emptyDir, []);
const emptyFilePath = join(emptyDir, ".relentless", "lessons.jsonl");
assert.strictEqual(existsSync(emptyFilePath), true, "writing empty lessons should still create file");
assert.deepStrictEqual(readLessons(emptyDir), [], "reading empty lessons file should return empty array");
console.log("PASS: writeLessons handles empty array");

clearLessons(ioDir);
assert.strictEqual(existsSync(join(ioDir, ".relentless", "lessons.jsonl")), false, "clearLessons should remove lessons file");
console.log("PASS: clearLessons removes persisted lessons file");

assert.strictEqual(categorizeError("Type 'string' is not assignable to type 'number'"), "type_error", "assignability errors should be type_error");
assert.strictEqual(categorizeError("Cannot find module './foo'"), "framework_gotcha", "missing module errors should be framework_gotcha");
assert.strictEqual(categorizeError("tsconfig.json parse error"), "config_error", "config parsing errors should be config_error");
assert.strictEqual(categorizeError("test assertion failed"), "test_failure", "test assertions should be test_failure");
assert.strictEqual(categorizeError("Build failed: tsc exit code 2"), "build_error", "build failures should be build_error");
assert.strictEqual(categorizeError("TypeError: undefined is not a function"), "runtime_error", "runtime type errors should be runtime_error");
assert.strictEqual(categorizeError("Anti-pattern detected: mutable global"), "pattern", "anti-pattern errors should be pattern");
assert.strictEqual(categorizeError("Some random error"), "other", "unknown errors should be other");
assert.strictEqual(categorizeError("Unexpected failure", "lib/foo.test.ts"), "test_failure", "test files should influence categorization");
console.log("PASS: categorizeError classifies known patterns and file hints");

assert.strictEqual(
  normalizePattern("Type 'string' is not assignable to type 'number'"),
  "Type mismatch: is not assignable to type",
  "type assignability should normalize to stable mismatch pattern",
);
assert.strictEqual(
  normalizePattern("Cannot find module './foo/bar'"),
  "Cannot find module (import resolution)",
  "module resolution errors should normalize to import pattern",
);
assert.strictEqual(
  normalizePattern("Build failed: tsc exit code 2"),
  "Build failed: tsc exit code",
  "build errors should strip numeric exit code",
);

const normalizedNoise = normalizePattern("Error in ./src/main.ts:12:5 and /tmp/workspace/file.ts:88:1 with 'secret' and \"value\"");
assert.strictEqual(normalizedNoise.includes("<path>"), true, "normalizePattern should replace file paths");
assert.strictEqual(/:\d+/.test(normalizedNoise), false, "normalizePattern should strip line numbers");
assert.strictEqual(normalizedNoise.includes("'<value>'"), true, "normalizePattern should replace single-quoted values");
assert.strictEqual(normalizedNoise.includes('"<value>"'), true, "normalizePattern should replace double-quoted values");
console.log("PASS: normalizePattern normalizes structural noise");

const idOne = generateLessonId("type_error", "Type mismatch: is not assignable to type");
const idTwo = generateLessonId("type_error", "Type mismatch: is not assignable to type");
const idThree = generateLessonId("import_error", "Cannot find module (import resolution)");
assert.strictEqual(idOne, idTwo, "same input should produce deterministic ID");
assert.notStrictEqual(idOne, idThree, "different input should produce different IDs");
assert.strictEqual(/^L-[0-9a-f]{8}$/.test(idOne), true, "ID format should match L-xxxxxxxx");
console.log("PASS: generateLessonId is deterministic and well-formed");

const extracted = extractLessons([
  {
    error: "Type 'string' is not assignable to type 'number'",
    agent: "artisan",
    file: "./src/a.ts",
    timestamp: "2026-03-12T01:00:00.000Z",
  },
  {
    error: "Type 'boolean' is not assignable to type 'number'",
    resolution: "Validate and cast value before assignment",
    agent: "sentinel",
    file: "./src/b.ts",
    timestamp: "2026-03-12T01:01:00.000Z",
  },
  {
    error: "Type 'string' is not assignable to type 'number'",
    resolution: "Cast value",
    agent: "artisan",
    file: "./src/a.ts",
    timestamp: "2026-03-12T00:59:00.000Z",
  },
]);

assert.strictEqual(extracted.length, 1, "only errors with resolutions should become lessons and merge by pattern");
assert.strictEqual(extracted[0].frequency, 2, "duplicate patterns should increment frequency");
assert.strictEqual(extracted[0].resolution, "Validate and cast value before assignment", "longer resolution should replace shorter one");
assert.deepStrictEqual(extracted[0].agents.sort(), ["artisan", "sentinel"], "agents should accumulate uniquely");
assert.strictEqual(extracted[0].examples.length, 2, "examples should accumulate from merged entries");
assert.strictEqual(extracted[0].first_seen, "2026-03-12T00:59:00.000Z", "first_seen should track earliest timestamp");
assert.strictEqual(extracted[0].last_seen, "2026-03-12T01:01:00.000Z", "last_seen should track latest timestamp");
assert.deepStrictEqual(extracted[0].source_files.sort(), ["src/a.ts", "src/b.ts"], "source files should normalize and accumulate");
console.log("PASS: extractLessons filters, merges, and prioritizes richer resolutions");

const existingId = generateLessonId("type_error", "Type mismatch: is not assignable to type");
const mergedWithExisting = extractLessons(
  [
    {
      error: "Type 'number' is not assignable to type 'string'",
      resolution: "Use explicit conversion",
      agent: "maestro",
      file: "src/c.ts",
      timestamp: "2026-03-12T02:00:00.000Z",
    },
  ],
  [
    {
      id: existingId,
      category: "type_error",
      pattern: "Type mismatch: is not assignable to type",
      resolution: "Cast value",
      frequency: 3,
      agents: ["artisan"],
      examples: ["Type 'x' is not assignable to type 'y'"],
      first_seen: "2026-03-12T00:00:00.000Z",
      last_seen: "2026-03-12T01:30:00.000Z",
      source_files: ["src/a.ts"],
    },
  ],
);
assert.strictEqual(mergedWithExisting.length, 1, "existing lesson should merge with incoming errors");
assert.strictEqual(mergedWithExisting[0].frequency, 4, "existing frequency should increment during merge");
assert.strictEqual(mergedWithExisting[0].last_seen, "2026-03-12T02:00:00.000Z", "last_seen should update when newer entries arrive");
assert.strictEqual(mergedWithExisting[0].first_seen, "2026-03-12T00:00:00.000Z", "first_seen should retain earliest existing timestamp");
console.log("PASS: extractLessons merges new errors into existing lessons");

const unchangedExisting: Lesson[] = [
  makeLesson(
    "L-z0000009",
    "other",
    "Random pattern",
    "Do nothing",
    2,
    "src/z.ts",
    "2026-03-12T02:30:00.000Z",
  ),
];
assert.deepStrictEqual(extractLessons([], unchangedExisting), unchangedExisting, "empty errors should return existing lessons unchanged");
console.log("PASS: extractLessons returns existing lessons for empty input");

const cappedErrors = Array.from({ length: 7 }, (_, index) => ({
  error: `Type '${index}' is not assignable to type 'number'`,
  resolution: "Use conversion helper before assignment",
  agent: `agent-${index + 1}`,
  file: `src/file-${index + 1}.ts`,
  timestamp: `2026-03-12T03:0${index}:00.000Z`,
}));
const capped = extractLessons(cappedErrors);
assert.strictEqual(capped.length, 1, "matching patterns should collapse into one lesson");
assert.strictEqual(capped[0].agents.length, 5, "agents should be capped at 5");
assert.deepStrictEqual(capped[0].agents, ["agent-3", "agent-4", "agent-5", "agent-6", "agent-7"], "agents cap should retain most recent values");
assert.strictEqual(capped[0].examples.length, 3, "examples should be capped at 3");
assert.strictEqual(capped[0].source_files.length, 5, "source files should be capped at 5");
assert.deepStrictEqual(
  capped[0].source_files,
  ["src/file-3.ts", "src/file-4.ts", "src/file-5.ts", "src/file-6.ts", "src/file-7.ts"],
  "source file cap should retain most recent values",
);
console.log("PASS: extractLessons enforces caps for agents, examples, and source files");

assert.strictEqual(formatLessonsForContext([]), "", "empty lessons should format to empty context");

const contextText = formatLessonsForContext([lessonA, lessonB, lessonC], 2);
assert.strictEqual(contextText.includes("## Learned Lessons (from previous pursuits)"), true, "formatted context should include heading");
assert.strictEqual(contextText.includes("[type_error]"), true, "formatted context should include category");
assert.strictEqual(contextText.includes("seen 5x"), true, "formatted context should include frequency");
assert.strictEqual(contextText.includes("Fix: Use proper types"), true, "formatted context should include resolution");
assert.strictEqual(contextText.includes("lib/b.ts"), true, "formatted context should include source files");
assert.strictEqual(contextText.includes("Build failed"), false, "maxLessons should limit rendered lessons");
console.log("PASS: formatLessonsForContext formats lessons and respects maxLessons");

assert.strictEqual(formatLessonsForHandoff([], ["lib/a.ts"]), "", "empty lesson set should produce empty handoff string");

const handoffSpecific = formatLessonsForHandoff([lessonA, lessonB, lessonC], ["lib/c.ts", "lib/unknown.ts"]);
assert.strictEqual(handoffSpecific.includes("## Relevant Lessons"), true, "handoff should include relevant lessons heading");
assert.strictEqual(handoffSpecific.includes("Lessons from similar files in this task:"), true, "handoff should include file-specific intro");
assert.strictEqual(handoffSpecific.includes("Cannot find module"), true, "handoff should include overlapping file lesson");
assert.strictEqual(handoffSpecific.includes("Type mismatch"), false, "handoff should exclude non-overlapping lessons when matches exist");
console.log("PASS: formatLessonsForHandoff returns file-specific lessons when available");

const handoffGeneral = formatLessonsForHandoff(
  [
    makeLesson("L-1", "other", "A", "R1", 1, "x/a.ts", "2026-03-12T00:01:00.000Z"),
    makeLesson("L-2", "other", "B", "R2", 5, "x/b.ts", "2026-03-12T00:02:00.000Z"),
    makeLesson("L-3", "other", "C", "R3", 4, "x/c.ts", "2026-03-12T00:03:00.000Z"),
    makeLesson("L-4", "other", "D", "R4", 3, "x/d.ts", "2026-03-12T00:04:00.000Z"),
  ],
  ["lib/no-overlap.ts"],
);
assert.strictEqual(handoffGeneral.includes("## Relevant Lessons (General)"), true, "handoff should fall back to general heading when no overlap");
assert.strictEqual(handoffGeneral.includes("No file-specific lessons found"), true, "handoff should include fallback intro");
assert.strictEqual(handoffGeneral.includes("[other] B"), true, "handoff fallback should include top-frequency lesson");
assert.strictEqual(handoffGeneral.includes("[other] C"), true, "handoff fallback should include second lesson");
assert.strictEqual(handoffGeneral.includes("[other] D"), true, "handoff fallback should include third lesson");
assert.strictEqual(handoffGeneral.includes("[other] A"), false, "handoff fallback should limit to top 3 lessons");
console.log("PASS: formatLessonsForHandoff falls back to top 3 general lessons");

const gotchaDir = join(TEST_DIR, "gotcha");
writeLessons(gotchaDir, [
  {
    id: "L-g0000001",
    category: "framework_gotcha",
    pattern: "Next.js route segment must include layout",
    resolution: "Add a layout.tsx for this route segment",
    frequency: 2,
    agents: ["artisan"],
    examples: ["Module not found in next package"],
    first_seen: "2026-03-12T04:00:00.000Z",
    last_seen: "2026-03-12T04:10:00.000Z",
    source_files: ["app/(marketing)/page.tsx"],
  },
]);
const gotchaMatches = getGotchasForStack(gotchaDir, ["next", "typescript"]);
assert.strictEqual(gotchaMatches.length, 1, "should find framework gotcha when stack matches pattern or examples");
assert.strictEqual(gotchaMatches[0].category, "framework_gotcha", "returned lesson should be framework_gotcha");
const gotchaMisses = getGotchasForStack(gotchaDir, ["svelte", "vue"]);
assert.deepStrictEqual(gotchaMisses, [], "should return empty array when stack does not match gotcha");
console.log("PASS: getGotchasForStack filters framework gotchas by stack");

rmSync(TEST_DIR, { recursive: true });
console.log("All lessons tests passed.");
