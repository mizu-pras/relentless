import { existsSync, readFileSync, readdirSync } from "fs";
import { dirname, join, resolve } from "path";
import { fileURLToPath } from "url";

import { parseJsonc as parseJsoncRaw } from "./jsonc.js";
import type { PursuitTodo } from "./state.js";

type JsonObject = Record<string, unknown>;

export interface PursuitTemplate {
  name: string;
  description: string;
  patterns: string[];
  default_todos: TemplateTodo[];
  suggested_agents: Record<string, string>;
  typical_files: string[];
  skip_brainstorming: boolean;
  skip_planning: boolean;
}

export interface TemplateTodo {
  id: string;
  subject: string;
  agent?: string;
}

export interface TemplateMatch {
  template: PursuitTemplate;
  confidence: number;
  matched_patterns: string[];
}

export function parseJsonc(text: string): JsonObject {
  return parseJsoncRaw(text) as JsonObject;
}

function isTemplateTodo(value: unknown): value is TemplateTodo {
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof (value as TemplateTodo).id === "string" &&
    typeof (value as TemplateTodo).subject === "string" &&
    ((value as TemplateTodo).agent === undefined || typeof (value as TemplateTodo).agent === "string")
  );
}

function isRecordString(value: unknown): value is Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  return Object.values(value).every((item) => typeof item === "string");
}

function isTemplate(value: unknown): value is PursuitTemplate {
  const candidate = value as PursuitTemplate;
  return (
    Boolean(value) &&
    typeof value === "object" &&
    typeof candidate.name === "string" &&
    typeof candidate.description === "string" &&
    Array.isArray(candidate.patterns) &&
    candidate.patterns.every((pattern) => typeof pattern === "string") &&
    Array.isArray(candidate.default_todos) &&
    candidate.default_todos.every((todo) => isTemplateTodo(todo)) &&
    isRecordString(candidate.suggested_agents) &&
    Array.isArray(candidate.typical_files) &&
    candidate.typical_files.every((pattern) => typeof pattern === "string") &&
    typeof candidate.skip_brainstorming === "boolean" &&
    typeof candidate.skip_planning === "boolean"
  );
}

function templateDirs(projectDir?: string): string[] {
  const dirs: string[] = [];
  if (projectDir) {
    dirs.push(join(projectDir, "templates"));
  }

  const envBuiltinDir = process.env.RELENTLESS_BUILTIN_TEMPLATES_DIR;
  if (envBuiltinDir) {
    dirs.push(resolve(envBuiltinDir));
    return dirs;
  }

  const moduleDir = dirname(fileURLToPath(import.meta.url));
  dirs.push(resolve(moduleDir, "..", "..", "templates"));
  dirs.push(resolve(moduleDir, "..", "templates"));
  return [...new Set(dirs)];
}

function loadTemplatesFromDir(dir: string): PursuitTemplate[] {
  if (!existsSync(dir)) {
    return [];
  }

  const files = readdirSync(dir)
    .filter((fileName) => fileName.endsWith(".jsonc"))
    .sort();

  const templates: PursuitTemplate[] = [];
  for (const fileName of files) {
    const path = join(dir, fileName);
    try {
      const parsed = parseJsonc(readFileSync(path, "utf8"));
      if (isTemplate(parsed)) {
        templates.push(parsed);
      }
    } catch {
      // Ignore malformed templates and continue loading the rest.
    }
  }

  return templates;
}

export function loadTemplates(projectDir?: string): PursuitTemplate[] {
  const loaded: PursuitTemplate[] = [];
  const seen = new Set<string>();

  for (const dir of templateDirs(projectDir)) {
    for (const template of loadTemplatesFromDir(dir)) {
      if (seen.has(template.name)) {
        continue;
      }
      seen.add(template.name);
      loaded.push(template);
    }
  }

  return loaded;
}

export function matchTemplates(task: string, templates: PursuitTemplate[]): TemplateMatch[] {
  const normalizedTask = task.toLowerCase();
  const matches: TemplateMatch[] = [];

  for (const template of templates) {
    if (template.patterns.length === 0) {
      continue;
    }

    const matchedPatterns = template.patterns.filter((pattern) => normalizedTask.includes(pattern.toLowerCase()));
    const confidence = matchedPatterns.length / template.patterns.length;

    if (confidence >= 0.3) {
      matches.push({
        template,
        confidence,
        matched_patterns: matchedPatterns,
      });
    }
  }

  return matches.sort((a, b) => b.confidence - a.confidence);
}

export function applyTemplate(template: PursuitTemplate): PursuitTodo[] {
  return template.default_todos.map((todo) => ({
    id: todo.id,
    subject: todo.subject,
    status: "pending",
    agent: todo.agent,
  }));
}

export function findBestTemplate(task: string, projectDir?: string): TemplateMatch | null {
  const templates = loadTemplates(projectDir);
  const matches = matchTemplates(task, templates);
  return matches[0] ?? null;
}
