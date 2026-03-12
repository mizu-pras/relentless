import { readFileSync, writeFileSync, existsSync, mkdirSync, appendFileSync, rmSync } from "fs";
import { join } from "path";

const SHARED_CONTEXT_DIR = ".relentless/shared-context";
const PROJECT_MAP_FILE = "project-map.md";
const CONVENTIONS_FILE = "conventions.md";
const DECISIONS_FILE = "decisions.jsonl";
const ERROR_LOG_FILE = "error-log.jsonl";
const FILE_SUMMARIES_FILE = "file-summaries.jsonl";

export interface Decision {
  decision: string;
  reason: string;
  agent: string;
  timestamp: string;
}

export interface ErrorEntry {
  error: string;
  resolution?: string;
  agent: string;
  file?: string;
  timestamp: string;
}

export interface FileSummary {
  file: string;
  summary: string;
  agent: string;
  timestamp: string;
}

export type MarkdownChannel = "project-map" | "conventions";
export type JsonlChannel = "decisions" | "error-log" | "file-summaries";

function sharedContextDir(projectDir?: string): string {
  return join(projectDir || ".", SHARED_CONTEXT_DIR);
}

function ensureSharedContextDir(projectDir?: string): string {
  const dir = sharedContextDir(projectDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function markdownFileFor(channel: MarkdownChannel): string {
  return channel === "project-map" ? PROJECT_MAP_FILE : CONVENTIONS_FILE;
}

function jsonlFileFor(channel: JsonlChannel): string {
  if (channel === "decisions") return DECISIONS_FILE;
  if (channel === "error-log") return ERROR_LOG_FILE;
  return FILE_SUMMARIES_FILE;
}

function readJsonl<T>(projectDir: string | undefined, channel: JsonlChannel, maxEntries?: number): T[] {
  const path = join(sharedContextDir(projectDir), jsonlFileFor(channel));
  if (!existsSync(path)) return [];
  try {
    const content = readFileSync(path, "utf8");
    const entries = content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .map((line) => JSON.parse(line) as T);
    if (typeof maxEntries === "number") {
      return maxEntries <= 0 ? [] : entries.slice(-maxEntries);
    }
    return entries;
  } catch {
    return [];
  }
}

function appendJsonl(projectDir: string | undefined, channel: JsonlChannel, entry: Decision | ErrorEntry): void {
  const dir = ensureSharedContextDir(projectDir);
  appendFileSync(join(dir, jsonlFileFor(channel)), `${JSON.stringify(entry)}\n`, "utf8");
}

export function writeMarkdownContext(projectDir: string | undefined, channel: MarkdownChannel, content: string): void {
  const dir = ensureSharedContextDir(projectDir);
  writeFileSync(join(dir, markdownFileFor(channel)), content, "utf8");
}

export function readMarkdownContext(projectDir: string | undefined, channel: MarkdownChannel): string {
  const path = join(sharedContextDir(projectDir), markdownFileFor(channel));
  if (!existsSync(path)) return "";
  try {
    return readFileSync(path, "utf8");
  } catch {
    return "";
  }
}

export function appendDecision(projectDir: string | undefined, entry: Decision): void {
  appendJsonl(projectDir, "decisions", entry);
}

export function appendError(projectDir: string | undefined, entry: ErrorEntry): void {
  appendJsonl(projectDir, "error-log", entry);
}

export function readDecisions(projectDir: string | undefined, maxEntries?: number): Decision[] {
  return readJsonl<Decision>(projectDir, "decisions", maxEntries);
}

export function readErrors(projectDir: string | undefined, maxEntries?: number): ErrorEntry[] {
  return readJsonl<ErrorEntry>(projectDir, "error-log", maxEntries);
}

export function writeSummary(projectDir: string | undefined, entry: FileSummary): void {
  const dir = ensureSharedContextDir(projectDir);
  const path = join(dir, FILE_SUMMARIES_FILE);
  let entries: FileSummary[] = [];
  if (existsSync(path)) {
    const content = readFileSync(path, "utf8");
    entries = content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .flatMap((line) => {
        try { return [JSON.parse(line) as FileSummary]; } catch { return []; }
      });
  }

  entries = entries.filter((existing) => existing.file !== entry.file);
  entries.push(entry);
  writeFileSync(path, entries.map((existing) => JSON.stringify(existing)).join("\n") + "\n", "utf8");
}

export function readSummary(projectDir: string | undefined, filePath: string): FileSummary | null {
  const all = readAllSummaries(projectDir);
  return all.find((entry) => entry.file === filePath) || null;
}

export function readAllSummaries(projectDir: string | undefined): FileSummary[] {
  return readJsonl<FileSummary>(projectDir, "file-summaries");
}

export function formatSummariesForHandoff(projectDir: string | undefined, filePaths: string[]): string {
  if (filePaths.length === 0) return "";
  const all = readAllSummaries(projectDir);
  const summaryMap = new Map(all.map((entry) => [entry.file, entry.summary]));

  const lines = filePaths.map((filePath) => {
    const safePath = filePath.replace(/`/g, "'");
    const summary = summaryMap.get(filePath);
    return summary
      ? `- \`${safePath}\`: ${sanitizeLine(summary)}`
      : `- \`${safePath}\`: (no summary available — agent should read this file)`;
  });

  return `## Context Summaries\n\n${lines.join("\n")}`;
}

const MAX_MARKDOWN_CHARS = 4000;

function truncateMarkdown(content: string, maxChars: number): string {
  if (content.length <= maxChars) return content;
  return content.slice(0, maxChars) + "\n\n...(truncated — full content in .relentless/shared-context/)";
}

function sanitizeLine(text: string): string {
  return text.replace(/\n/g, " ");
}

export function formatSharedContext(
  projectDir: string | undefined,
  maxDecisions = 10,
  maxErrors = 5
): string {
  const projectMap = readMarkdownContext(projectDir, "project-map");
  const conventions = readMarkdownContext(projectDir, "conventions");
  const decisions = readDecisions(projectDir, maxDecisions);
  const errors = readErrors(projectDir, maxErrors);

  // Return empty string when all channels are empty (W-3: avoid injecting placeholder-only context)
  if (!projectMap && !conventions && decisions.length === 0 && errors.length === 0) {
    return "";
  }

  const decisionLines =
    decisions.length > 0
      ? decisions.map((entry) => `- ${sanitizeLine(entry.decision)} (reason: ${sanitizeLine(entry.reason)}) — ${entry.agent}`).join("\n")
      : "(none)";

  const errorLines =
    errors.length > 0
      ? errors
          .map((entry) => {
            const resolution = entry.resolution || "(unresolved)";
            return `- ${sanitizeLine(entry.error)} → ${sanitizeLine(resolution)} — ${entry.agent}`;
          })
          .join("\n")
      : "(none)";

  return `## Shared Context

### Project Map
${truncateMarkdown(projectMap || "(not yet mapped)", MAX_MARKDOWN_CHARS)}

### Conventions
${truncateMarkdown(conventions || "(not yet established)", MAX_MARKDOWN_CHARS)}

### Recent Decisions (last ${maxDecisions})
${decisionLines}

### Recent Errors (last ${maxErrors})
${errorLines}`;
}

export function clearSharedContext(projectDir: string | undefined): void {
  const dir = sharedContextDir(projectDir);
  if (existsSync(dir)) {
    rmSync(dir, { recursive: true, force: true });
  }
}
