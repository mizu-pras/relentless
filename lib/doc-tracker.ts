import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "fs";
import { join } from "path";

const SHARED_CONTEXT_DIR = ".relentless/shared-context";
const DOC_DIRTY_FILE = "doc-dirty.jsonl";

export interface DocDirtyEntry {
  docFile: string;
  reason: string;
  triggeredBy: string;
  agent: string;
  markedAt: string;
  status: "dirty" | "resolved";
  resolvedAt?: string;
  resolvedBy?: string;
}

export interface DocPattern {
  glob: string;
  docs: string[];
}

export const DEFAULT_DOC_PATTERNS: DocPattern[] = [
  { glob: "lib/**/*.ts", docs: ["lib/AGENTS.md", "README.md"] },
  { glob: "skills/**/*", docs: ["skills/AGENTS.md", "README.md"] },
  { glob: "agents/**/*", docs: ["agents/AGENTS.md", "README.md"] },
  { glob: "commands/**/*", docs: ["commands/AGENTS.md", "README.md"] },
  { glob: "**/*", docs: ["README.md"] },
];

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

function docDirtyPath(projectDir?: string): string {
  return join(sharedContextDir(projectDir), DOC_DIRTY_FILE);
}

function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function matchesGlob(filePath: string, pattern: string): boolean {
  const pathSegments = normalizePath(filePath).split("/").filter((segment) => segment.length > 0);
  const patternSegments = normalizePath(pattern).split("/").filter((segment) => segment.length > 0);

  const matchSegment = (value: string, globSegment: string): boolean => {
    if (globSegment === "*") return true;
    const parts = globSegment.split("*");
    if (parts.length === 1) return value === globSegment;

    let position = 0;
    if (!globSegment.startsWith("*")) {
      const first = parts[0] || "";
      if (!value.startsWith(first)) return false;
      position = first.length;
    }

    for (let index = 1; index < parts.length - 1; index++) {
      const part = parts[index] || "";
      if (part.length === 0) continue;
      const found = value.indexOf(part, position);
      if (found === -1) return false;
      position = found + part.length;
    }

    const last = parts[parts.length - 1] || "";
    if (!globSegment.endsWith("*")) {
      return value.endsWith(last);
    }

    if (last.length === 0) return true;
    return value.indexOf(last, position) !== -1;
  };

  const matchRecursive = (pathIndex: number, patternIndex: number): boolean => {
    if (patternIndex === patternSegments.length) {
      return pathIndex === pathSegments.length;
    }

    const currentPattern = patternSegments[patternIndex];
    if (currentPattern === "**") {
      for (let nextPath = pathIndex; nextPath <= pathSegments.length; nextPath++) {
        if (matchRecursive(nextPath, patternIndex + 1)) {
          return true;
        }
      }
      return false;
    }

    if (pathIndex >= pathSegments.length) return false;
    if (!matchSegment(pathSegments[pathIndex], currentPattern)) return false;
    return matchRecursive(pathIndex + 1, patternIndex + 1);
  };

  return matchRecursive(0, 0);
}

function readEntries(projectDir: string | undefined): DocDirtyEntry[] {
  const path = docDirtyPath(projectDir);
  if (!existsSync(path)) return [];

  try {
    const content = readFileSync(path, "utf8");
    return content
      .split("\n")
      .filter((line) => line.trim().length > 0)
      .flatMap((line) => {
        try {
          return [JSON.parse(line) as DocDirtyEntry];
        } catch {
          return [];
        }
      });
  } catch {
    return [];
  }
}

function writeEntries(projectDir: string | undefined, entries: DocDirtyEntry[]): void {
  const dir = ensureSharedContextDir(projectDir);
  const path = join(dir, DOC_DIRTY_FILE);
  if (entries.length === 0) {
    if (existsSync(path)) {
      rmSync(path, { force: true });
    }
    return;
  }
  writeFileSync(path, entries.map((entry) => JSON.stringify(entry)).join("\n") + "\n", "utf8");
}

function appendEntry(projectDir: string | undefined, entry: DocDirtyEntry): void {
  const dir = ensureSharedContextDir(projectDir);
  appendFileSync(join(dir, DOC_DIRTY_FILE), `${JSON.stringify(entry)}\n`, "utf8");
}

function hasUnresolved(entries: DocDirtyEntry[], docFile: string): DocDirtyEntry | undefined {
  return entries.find((entry) => entry.docFile === docFile && entry.status === "dirty");
}

export function markDocDirty(
  projectDir: string | undefined,
  docFile: string,
  reason: string,
  triggeredBy: string,
  agent: string
): DocDirtyEntry {
  const normalizedDocFile = normalizePath(docFile);
  const normalizedTriggeredBy = normalizePath(triggeredBy);
  const entries = readEntries(projectDir);
  const existing = hasUnresolved(entries, normalizedDocFile);
  if (existing) return existing;

  const entry: DocDirtyEntry = {
    docFile: normalizedDocFile,
    reason,
    triggeredBy: normalizedTriggeredBy,
    agent,
    markedAt: new Date().toISOString(),
    status: "dirty",
  };
  appendEntry(projectDir, entry);
  return entry;
}

export function markDocsDirty(
  projectDir: string | undefined,
  triggeredBy: string,
  agent: string,
  patterns: DocPattern[] = DEFAULT_DOC_PATTERNS
): DocDirtyEntry[] {
  const normalizedTriggeredBy = normalizePath(triggeredBy);
  const docsToMark = new Set<string>();
  for (const pattern of patterns) {
    if (matchesGlob(normalizedTriggeredBy, pattern.glob)) {
      for (const docFile of pattern.docs) {
        docsToMark.add(normalizePath(docFile));
      }
    }
  }

  const created: DocDirtyEntry[] = [];
  for (const docFile of docsToMark) {
    const before = readEntries(projectDir).length;
    const entry = markDocDirty(projectDir, docFile, `${normalizedTriggeredBy} was modified`, normalizedTriggeredBy, agent);
    const after = readEntries(projectDir).length;
    if (after > before) {
      created.push(entry);
    }
  }
  return created;
}

export function resolveDoc(projectDir: string | undefined, docFile: string, agent: string): boolean {
  const normalizedDocFile = normalizePath(docFile);
  const entries = readEntries(projectDir);
  let found = false;

  const now = new Date().toISOString();
  const updated = entries.map((entry) => {
    if (entry.docFile === normalizedDocFile && entry.status === "dirty") {
      found = true;
      return {
        ...entry,
        status: "resolved" as const,
        resolvedAt: now,
        resolvedBy: agent,
      };
    }
    return entry;
  });

  if (!found) return false;
  writeEntries(projectDir, updated);
  return true;
}

export function readDirtyDocs(projectDir: string | undefined): DocDirtyEntry[] {
  return readEntries(projectDir).filter((entry) => entry.status === "dirty");
}

export function readAllDocEntries(projectDir: string | undefined): DocDirtyEntry[] {
  return readEntries(projectDir);
}

export function formatDirtyDocsReport(projectDir: string | undefined): string {
  const dirty = readDirtyDocs(projectDir);
  if (dirty.length === 0) {
    return "No dirty documentation entries.";
  }

  const lines = dirty.map((entry) => {
    const doc = entry.docFile.replace(/`/g, "'");
    const reason = entry.reason.replace(/\n/g, " ");
    const source = entry.triggeredBy.replace(/`/g, "'");
    return `- \`${doc}\` (triggered by \`${source}\`) - ${reason} [agent: ${entry.agent}]`;
  });

  return `## Dirty Documentation Report\n\n${lines.join("\n")}`;
}

/**
 * Check if a specific documentation file is currently dirty (unresolved).
 * Used by recon --update to check if an AGENTS.md needs refresh.
 *
 * @param projectDir - Project directory
 * @param docFile - Path to the doc file to check (e.g. "lib/AGENTS.md")
 * @returns true if the doc has at least one unresolved dirty entry
 */
export function isDirtyDoc(projectDir: string | undefined, docFile: string): boolean {
  const normalizedDocFile = normalizePath(docFile);
  const entries = readEntries(projectDir);
  return entries.some((entry) => entry.docFile === normalizedDocFile && entry.status === "dirty");
}

/**
 * Get all dirty entries for specific doc files.
 * Used by recon to get details about WHY specific AGENTS.md files are dirty
 * (which source files triggered them).
 *
 * @param projectDir - Project directory
 * @param docFiles - Array of doc file paths to filter for
 * @returns Array of dirty entries matching any of the specified doc files
 */
export function getDirtyDocsByFile(projectDir: string | undefined, docFiles: string[]): DocDirtyEntry[] {
  const normalizedFiles = new Set(docFiles.map(normalizePath));
  return readEntries(projectDir).filter(
    (entry) => entry.status === "dirty" && normalizedFiles.has(entry.docFile)
  );
}

export function clearDocTracking(projectDir: string | undefined): void {
  const path = docDirtyPath(projectDir);
  if (existsSync(path)) {
    rmSync(path, { force: true });
  }
}
