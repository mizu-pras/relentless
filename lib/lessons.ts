import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync } from "fs";
import { join } from "path";
import { homedir } from "os";
import { ErrorEntry } from "./shared-context.js";

const STATE_DIR = ".relentless";
const LESSONS_FILE = "lessons.jsonl";

export interface Lesson {
  id: string;
  category: LessonCategory;
  pattern: string;
  resolution: string;
  frequency: number;
  agents: string[];
  examples: string[];
  first_seen: string;
  last_seen: string;
  source_files: string[];
}

export type LessonCategory =
  | "type_error"
  | "framework_gotcha"
  | "import_error"
  | "config_error"
  | "test_failure"
  | "build_error"
  | "runtime_error"
  | "pattern"
  | "convention"
  | "agent_performance"
  | "other";

function lessonsPath(projectDir?: string): string {
  return join(projectDir || ".", STATE_DIR, LESSONS_FILE);
}

function globalLessonsPath(): string {
  return join(homedir(), ".config", "opencode", "relentless", "global-lessons.jsonl");
}

function resolveGlobalLessonsPath(globalDir?: string): string {
  return globalDir ? join(globalDir, "global-lessons.jsonl") : globalLessonsPath();
}

function ensureStateDir(projectDir?: string): string {
  const dir = join(projectDir || ".", STATE_DIR);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function ensureParentDir(filePath: string): void {
  const parts = filePath.replace(/\\/g, "/").split("/");
  const parent = parts.slice(0, -1).join("/");
  if (!parent) return;
  if (!existsSync(parent)) {
    mkdirSync(parent, { recursive: true });
  }
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

function sanitizeLine(text: string): string {
  return text.replace(/\n/g, " ").replace(/`/g, "'").trim();
}

function sortLessons(lessons: Lesson[]): Lesson[] {
  return [...lessons].sort((a, b) => {
    if (b.frequency !== a.frequency) return b.frequency - a.frequency;
    return b.last_seen.localeCompare(a.last_seen);
  });
}

function pushUniqueCapped(values: string[], value: string, cap: number): string[] {
  const clean = value.trim();
  if (!clean) return values;
  if (values.includes(clean)) return values;
  const next = [...values, clean];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

function normalizeExistingLesson(lesson: Lesson): Lesson {
  return {
    ...lesson,
    agents: Array.isArray(lesson.agents) ? lesson.agents.slice(0, 5) : [],
    examples: Array.isArray(lesson.examples) ? lesson.examples.slice(0, 3) : [],
    source_files: Array.isArray(lesson.source_files) ? lesson.source_files.slice(0, 5) : [],
  };
}

function readLessonsFromPath(path: string, maxEntries?: number): Lesson[] {
  if (!existsSync(path)) return [];

  try {
    const content = readFileSync(path, "utf8");
    const entries = content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .flatMap((line) => {
        try {
          return [normalizeExistingLesson(JSON.parse(line) as Lesson)];
        } catch {
          return [];
        }
      });

    const limited = typeof maxEntries === "number" ? (maxEntries <= 0 ? [] : entries.slice(0, maxEntries)) : entries;
    return sortLessons(limited);
  } catch {
    return [];
  }
}

function writeLessonsToPath(path: string, lessons: Lesson[]): void {
  ensureParentDir(path);
  if (lessons.length === 0) {
    writeFileSync(path, "", "utf8");
    return;
  }

  const normalized = sortLessons(lessons).map((lesson) => normalizeExistingLesson(lesson));
  writeFileSync(path, normalized.map((entry) => JSON.stringify(entry)).join("\n") + "\n", "utf8");
}

function hasSourceDiversity(sourceFiles: string[]): boolean {
  const uniqueFiles = Array.from(new Set(sourceFiles.map((file) => normalizePath(file)).filter(Boolean)));
  return uniqueFiles.length >= 2;
}

function stackMatchesLesson(lesson: Lesson, stack: string[]): boolean {
  return stack.some((entry) => {
    const keyword = entry.toLowerCase();
    return (
      lesson.pattern.toLowerCase().includes(keyword) ||
      lesson.examples.some((example) => typeof example === "string" && example.toLowerCase().includes(keyword))
    );
  });
}

/**
 * Read lessons from persistent JSONL storage.
 *
 * @param projectDir - Project directory
 * @param maxEntries - Optional max number of latest entries to include
 * @returns Lessons sorted by frequency DESC, then last_seen DESC
 */
export function readLessons(projectDir?: string, maxEntries?: number): Lesson[] {
  return readLessonsFromPath(lessonsPath(projectDir), maxEntries);
}

/**
 * Overwrite all lessons in persistent JSONL storage.
 *
 * @param projectDir - Project directory
 * @param lessons - Complete lesson list to persist
 */
export function writeLessons(projectDir: string | undefined, lessons: Lesson[]): void {
  ensureStateDir(projectDir);
  writeLessonsToPath(lessonsPath(projectDir), lessons);
}

export function readGlobalLessons(maxEntries?: number, globalDir?: string): Lesson[] {
  return readLessonsFromPath(resolveGlobalLessonsPath(globalDir), maxEntries);
}

export function writeGlobalLessons(lessons: Lesson[], globalDir?: string): void {
  writeLessonsToPath(resolveGlobalLessonsPath(globalDir), lessons);
}

export function promoteToGlobal(projectDir: string | undefined, projectId: string, globalDir?: string): number {
  const projectLessons = readLessons(projectDir);
  const candidates = projectLessons.filter(
    (lesson) => lesson.category !== "agent_performance" && lesson.frequency >= 3 && hasSourceDiversity(lesson.source_files),
  );
  if (candidates.length === 0) return 0;

  const globalLessons = readGlobalLessons(undefined, globalDir);
  const merged = new Map<string, Lesson>();
  for (const lesson of globalLessons) {
    merged.set(lesson.id, normalizeExistingLesson(lesson));
  }

  for (const lesson of candidates) {
    const projectTag = `[project:${projectId}]`;
    const incoming = normalizeExistingLesson({
      ...lesson,
      examples: pushUniqueCapped(lesson.examples, projectTag, 3),
    });

    const existing = merged.get(lesson.id);
    if (!existing) {
      merged.set(lesson.id, incoming);
      continue;
    }

    existing.frequency += incoming.frequency;
    if (incoming.last_seen > existing.last_seen) {
      existing.last_seen = incoming.last_seen;
    }
    if (incoming.first_seen < existing.first_seen) {
      existing.first_seen = incoming.first_seen;
    }
    if (incoming.resolution.length > existing.resolution.length) {
      existing.resolution = incoming.resolution;
    }
    for (const agent of incoming.agents) {
      existing.agents = pushUniqueCapped(existing.agents, agent, 5);
    }
    for (const example of incoming.examples) {
      existing.examples = pushUniqueCapped(existing.examples, example, 3);
    }
    for (const file of incoming.source_files) {
      existing.source_files = pushUniqueCapped(existing.source_files, file, 5);
    }
  }

  writeGlobalLessons(Array.from(merged.values()), globalDir);
  return candidates.length;
}

export function mergeGlobalLessons(projectDir: string | undefined, stack?: string[], globalDir?: string): Lesson[] {
  void projectDir;
  const globalLessons = readGlobalLessons(undefined, globalDir);
  return sortLessons(globalLessons.filter((lesson) => {
    if (lesson.category === "agent_performance") return false;
    if (!stack || stack.length === 0) return true;
    return stackMatchesLesson(lesson, stack);
  }));
}

/**
 * Clear persisted lessons storage.
 *
 * @param projectDir - Project directory
 */
export function clearLessons(projectDir?: string): void {
  const path = lessonsPath(projectDir);
  if (existsSync(path)) {
    unlinkSync(path);
  }
}

/**
 * Categorize an error into a coarse lesson category.
 *
 * @param error - Error message text
 * @param file - Optional source file path
 * @returns Lesson category derived from keywords
 */
export function categorizeError(error: string, file?: string): LessonCategory {
  const text = `${error || ""} ${file || ""}`;
  const lower = text.toLowerCase();

  if (
    /route group/i.test(text) ||
    /route segment/i.test(text) ||
    /cannot find module/i.test(text) ||
    /module not found/i.test(text) ||
    ((/\bdependency\b/.test(lower) || /\bpackage\b/.test(lower)) && (/\bmissing\b/.test(lower) || /not found/i.test(text)))
  ) {
    return "framework_gotcha";
  }

  if (
    /is not assignable to type/i.test(text) ||
    /property\s+.+\s+does not exist/i.test(text) ||
    /\btype\b/.test(lower)
  ) {
    return "type_error";
  }
  if (/cannot find module/i.test(text) || /module not found/i.test(text) || /\bimport\b/.test(lower) || /\brequire\b/.test(lower)) {
    return "import_error";
  }
  if (/tsconfig/i.test(text) || /package\.json/i.test(text) || /webpack/i.test(text) || /vite/i.test(text) || /\bconfig\b/.test(lower)) {
    return "config_error";
  }
  if (
    /\btest\b/.test(lower) ||
    /\bassert\b/.test(lower) ||
    /\bexpect\b/.test(lower) ||
    /\bfail\b/.test(lower) ||
    /\.test\./.test(lower) ||
    /\.spec\./.test(lower)
  ) {
    return "test_failure";
  }
  if (/\bbuild\b/.test(lower) || /\bcompile\b/.test(lower) || /\btsc\b/.test(lower) || /esbuild/i.test(text)) {
    return "build_error";
  }
  if (/\bruntime\b/.test(lower) || /typeerror/i.test(text) || /referenceerror/i.test(text) || /undefined is not/i.test(text)) {
    return "runtime_error";
  }
  if (/anti-pattern/i.test(text) || /\bpattern\b/.test(lower) || /\bconvention\b/.test(lower)) {
    return "pattern";
  }
  return "other";
}

export function getGotchasForStack(projectDir: string | undefined, stack: string[]): Lesson[] {
  const lessons = readLessons(projectDir);
  return lessons.filter(
    (l) =>
      l.category === "framework_gotcha" &&
      stack.some(
        (s) =>
          l.pattern.toLowerCase().includes(s.toLowerCase()) ||
          l.examples.some((e) => typeof e === "string" && e.toLowerCase().includes(s.toLowerCase())),
      ),
  );
}

/**
 * Normalize noisy error text into a reusable structural pattern.
 *
 * @param error - Raw error text
 * @returns Normalized, stable pattern string
 */
export function normalizePattern(error: string): string {
  const clean = sanitizeLine(error);

  if (/is not assignable to type/i.test(clean) || /property\s+.+\s+does not exist/i.test(clean)) {
    return "Type mismatch: is not assignable to type";
  }

  if (/cannot find module/i.test(clean) || /module not found/i.test(clean)) {
    return "Cannot find module (import resolution)";
  }

  if (/build failed/i.test(clean) || /compile/i.test(clean) || /\btsc\b/i.test(clean) || /esbuild/i.test(clean)) {
    return clean
      .replace(/:\s*.*?(tsc|esbuild)\s+exit\s+code\s*\d+/i, ": $1 exit code")
      .replace(/exit\s+code\s*\d+/gi, "exit code")
      .replace(/\s+/g, " ")
      .trim();
  }

  return clean
    .replace(/([A-Za-z]:)?[\\/][^\s)\]"']+/g, "<path>")
    .replace(/\.{1,2}\/[A-Za-z0-9_./-]+/g, "<path>")
    .replace(/:\d+(?::\d+)?/g, "")
    .replace(/'[^']*'/g, "'<value>'")
    .replace(/"[^"]*"/g, '"<value>"')
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Generate a deterministic lesson identifier from category and pattern.
 *
 * @param category - Lesson category
 * @param pattern - Normalized pattern
 * @returns Stable short ID formatted as L-xxxxxxxx
 */
export function generateLessonId(category: LessonCategory, pattern: string): string {
  const seed = `${category}:${pattern.toLowerCase()}`;
  let hash = 5381;
  for (let index = 0; index < seed.length; index++) {
    hash = ((hash << 5) + hash) ^ seed.charCodeAt(index);
    hash >>>= 0;
  }
  return `L-${hash.toString(16).padStart(8, "0").slice(0, 8)}`;
}

/**
 * Extract and merge durable lessons from resolved error entries.
 *
 * @param errors - Error entries to process
 * @param existingLessons - Existing lessons to merge into
 * @returns Merged lessons sorted by frequency DESC
 */
export function extractLessons(errors: ErrorEntry[], existingLessons: Lesson[] = []): Lesson[] {
  const now = new Date().toISOString();
  const merged = new Map<string, Lesson>();

  for (const lesson of existingLessons) {
    merged.set(lesson.id, normalizeExistingLesson(lesson));
  }

  for (const entry of errors) {
    if (!entry.error) continue; // guard against corrupt entries
    const resolution = (entry.resolution || "").trim();
    if (!resolution) continue;

    const category = categorizeError(entry.error, entry.file);
    const pattern = normalizePattern(entry.error);
    const id = generateLessonId(category, pattern);
    const timestamp = entry.timestamp || now;

    const existing = merged.get(id);
    if (!existing) {
      merged.set(id, {
        id,
        category,
        pattern,
        resolution,
        frequency: 1,
        agents: entry.agent ? [entry.agent] : [],
        examples: entry.error ? [sanitizeLine(entry.error)] : [],
        first_seen: timestamp,
        last_seen: timestamp,
        source_files: entry.file ? [normalizePath(entry.file)] : [],
      });
      continue;
    }

    existing.frequency += 1;
    if (timestamp > existing.last_seen) {
      existing.last_seen = timestamp;
    }
    if (timestamp < existing.first_seen) {
      existing.first_seen = timestamp;
    }
    if (resolution.length > (existing.resolution || "").length) {
      existing.resolution = resolution;
    }

    if (entry.agent) {
      existing.agents = pushUniqueCapped(existing.agents, entry.agent, 5);
    }
    if (entry.error) {
      existing.examples = pushUniqueCapped(existing.examples, sanitizeLine(entry.error), 3);
    }
    if (entry.file) {
      existing.source_files = pushUniqueCapped(existing.source_files, normalizePath(entry.file), 5);
    }
  }

  return sortLessons(Array.from(merged.values()));
}

/**
 * Format learned lessons for generic context injection.
 *
 * @param lessons - Lessons to render
 * @param maxLessons - Maximum number of top lessons to include
 * @returns Markdown block or empty string when no lessons exist
 */
export function formatLessonsForContext(lessons: Lesson[], maxLessons = 10): string {
  if (lessons.length === 0) return "";

  const top = sortLessons(lessons).slice(0, Math.max(0, maxLessons));
  if (top.length === 0) return "";

  const lines = top
    .map((lesson, index) => {
      const files = lesson.source_files.length > 0 ? lesson.source_files.join(", ") : "(none)";
      return `${index + 1}. **[${lesson.category}]** (seen ${lesson.frequency}x): ${sanitizeLine(lesson.pattern)}\n   → Fix: ${sanitizeLine(lesson.resolution)}\n   Files: ${sanitizeLine(files)}`;
    })
    .join("\n\n");

  return `## Learned Lessons (from previous pursuits)\n\nThese are patterns learned from past mistakes. Avoid repeating them.\n\n${lines}`;
}

/**
 * Format lessons relevant to a specific handoff file set.
 *
 * @param lessons - Full lesson list
 * @param taskFiles - Files assigned in the current handoff
 * @returns Compact markdown block with relevant guidance
 */
export function formatLessonsForHandoff(lessons: Lesson[], taskFiles: string[]): string {
  if (lessons.length === 0) return "";

  const normalizedTaskFiles = new Set(taskFiles.map(normalizePath));
  const relevant = lessons.filter((lesson) =>
    lesson.source_files.some((file) => normalizedTaskFiles.has(normalizePath(file)))
  );

  const selected = relevant.length > 0 ? sortLessons(relevant) : sortLessons(lessons).slice(0, 3);
  if (selected.length === 0) return "";

  const title = relevant.length > 0 ? "## Relevant Lessons" : "## Relevant Lessons (General)";
  const intro =
    relevant.length > 0
      ? "Lessons from similar files in this task:"
      : "No file-specific lessons found; applying top recurring lessons:";

  const lines = selected
    .map((lesson, index) => {
      const files = lesson.source_files.length > 0 ? lesson.source_files.join(", ") : "(none)";
      return `${index + 1}. [${lesson.category}] ${sanitizeLine(lesson.pattern)} (seen ${lesson.frequency}x)\n   Fix: ${sanitizeLine(lesson.resolution)}\n   Files: ${sanitizeLine(files)}`;
    })
    .join("\n\n");

  return `${title}\n\n${intro}\n\n${lines}`;
}
