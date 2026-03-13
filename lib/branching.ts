import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join, resolve } from "path";

const STATE_DIR = ".relentless";
const BRANCHES_FILE = "branches.json";
const DEFAULT_MAX_BRANCHES = 3;

export interface PursuitBranch {
  id: string;
  name: string;
  task: string;
  parent_pursuit_id?: string;
  git_branch: string;
  worktree_path: string;
  status: "active" | "paused" | "merged" | "abandoned";
  created_at: string;
  updated_at: string;
}

export interface BranchRegistry {
  branches: PursuitBranch[];
  max_branches: number;
  active_branch?: string;
}

function stateDir(projectDir?: string): string {
  return join(projectDir || ".", STATE_DIR);
}

function ensureStateDir(projectDir?: string): string {
  const dir = stateDir(projectDir);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  return dir;
}

function branchesPath(projectDir?: string): string {
  return join(stateDir(projectDir), BRANCHES_FILE);
}

function normalizeRegistry(value: unknown): BranchRegistry {
  if (!value || typeof value !== "object") {
    return { branches: [], max_branches: DEFAULT_MAX_BRANCHES };
  }

  const candidate = value as Partial<BranchRegistry>;
  const branches = Array.isArray(candidate.branches) ? candidate.branches : [];
  const max = typeof candidate.max_branches === "number" && Number.isFinite(candidate.max_branches)
    ? Math.max(1, Math.floor(candidate.max_branches))
    : DEFAULT_MAX_BRANCHES;

  const activeBranch = typeof candidate.active_branch === "string" ? candidate.active_branch : undefined;

  return {
    branches,
    max_branches: max,
    ...(activeBranch ? { active_branch: activeBranch } : {}),
  };
}

function updateBranch(
  projectDir: string | undefined,
  branchId: string,
  updater: (branch: PursuitBranch, registry: BranchRegistry) => void,
): PursuitBranch {
  const registry = readBranchRegistry(projectDir);
  const index = registry.branches.findIndex((branch) => branch.id === branchId);
  if (index === -1) {
    throw new Error(`Branch not found: ${branchId}`);
  }

  const branch = registry.branches[index];
  updater(branch, registry);
  branch.updated_at = new Date().toISOString();
  registry.branches[index] = branch;
  writeBranchRegistry(projectDir, registry);
  return branch;
}

export function readBranchRegistry(projectDir?: string): BranchRegistry {
  const filePath = branchesPath(projectDir);
  if (!existsSync(filePath)) {
    return { branches: [], max_branches: DEFAULT_MAX_BRANCHES };
  }

  try {
    const parsed = JSON.parse(readFileSync(filePath, "utf8"));
    return normalizeRegistry(parsed);
  } catch {
    return { branches: [], max_branches: DEFAULT_MAX_BRANCHES };
  }
}

export function writeBranchRegistry(projectDir: string | undefined, registry: BranchRegistry): void {
  const dir = ensureStateDir(projectDir);
  writeFileSync(join(dir, BRANCHES_FILE), JSON.stringify(registry, null, 2), "utf8");
}

export function sanitizeBranchName(task: string): string {
  return task.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 50) || "untitled";
}

export function createBranch(projectDir: string | undefined, task: string, parentPursuitId?: string): PursuitBranch {
  const registry = readBranchRegistry(projectDir);
  const activeOrPaused = registry.branches.filter((branch) => branch.status === "active" || branch.status === "paused");
  if (activeOrPaused.length >= registry.max_branches) {
    throw new Error("Maximum number of active pursuit branches exceeded");
  }

  const sanitized = sanitizeBranchName(task);
  const existsByName = registry.branches.some((branch) => branch.name === sanitized);
  if (existsByName) {
    throw new Error(`Branch name already exists: ${sanitized}`);
  }

  const now = new Date().toISOString();
  const id = `branch-${Date.now()}`;
  const branch: PursuitBranch = {
    id,
    name: sanitized,
    task,
    ...(parentPursuitId ? { parent_pursuit_id: parentPursuitId } : {}),
    git_branch: `pursuit/${sanitized}`,
    worktree_path: resolve(projectDir || ".", ".worktrees", `pursuit-${id}`),
    status: "active",
    created_at: now,
    updated_at: now,
  };

  if (registry.active_branch) {
    registry.branches = registry.branches.map((entry) =>
      entry.id === registry.active_branch ? { ...entry, status: "paused", updated_at: now } : entry,
    );
  }

  registry.branches.push(branch);
  registry.active_branch = branch.id;
  writeBranchRegistry(projectDir, registry);
  return branch;
}

export function listBranches(projectDir?: string): PursuitBranch[] {
  return readBranchRegistry(projectDir).branches;
}

export function getBranch(projectDir: string | undefined, branchId: string): PursuitBranch | null {
  return readBranchRegistry(projectDir).branches.find((branch) => branch.id === branchId) || null;
}

export function switchBranch(projectDir: string | undefined, branchId: string): PursuitBranch {
  const registry = readBranchRegistry(projectDir);
  const target = registry.branches.find((branch) => branch.id === branchId);
  if (!target) {
    throw new Error(`Branch not found: ${branchId}`);
  }

  if (target.status === "merged" || target.status === "abandoned") {
    throw new Error(`Cannot switch to ${target.status} branch: ${branchId}`);
  }

  const now = new Date().toISOString();
  registry.branches = registry.branches.map((branch) => {
    if (branch.id === branchId) {
      return { ...branch, status: "active", updated_at: now };
    }
    if (branch.id === registry.active_branch && branch.status === "active") {
      return { ...branch, status: "paused", updated_at: now };
    }
    return branch;
  });

  registry.active_branch = branchId;
  writeBranchRegistry(projectDir, registry);
  return registry.branches.find((branch) => branch.id === branchId) as PursuitBranch;
}

export function mergeBranch(projectDir: string | undefined, branchId: string): PursuitBranch {
  return updateBranch(projectDir, branchId, (branch, registry) => {
    branch.status = "merged";
    if (registry.active_branch === branchId) {
      delete registry.active_branch;
    }
  });
}

export function abandonBranch(projectDir: string | undefined, branchId: string): PursuitBranch {
  return updateBranch(projectDir, branchId, (branch, registry) => {
    branch.status = "abandoned";
    if (registry.active_branch === branchId) {
      delete registry.active_branch;
    }
  });
}

export function formatBranchList(
  branches: PursuitBranch[],
  activeBranchId?: string,
  maxBranches = DEFAULT_MAX_BRANCHES,
): string {
  const lines: string[] = [];
  lines.push("## Pursuit Branches");
  lines.push("");
  lines.push("| ID | Name | Status | Task | Created |");
  lines.push("|----|------|--------|------|---------|");

  if (branches.length === 0) {
    lines.push("| (none) | (none) | (none) | (none) | (none) |",
    );
  } else {
    for (const branch of branches) {
      const marker = branch.id === activeBranchId ? "* " : "";
      const created = branch.created_at.split("T")[0] || branch.created_at;
      lines.push(`| ${branch.id} | ${marker}${branch.name} | ${branch.status} | ${branch.task} | ${created} |`);
    }
  }

  const openBranches = branches.filter((branch) => branch.status === "active" || branch.status === "paused").length;
  const availableSlots = Math.max(0, maxBranches - openBranches);
  lines.push("");
  lines.push(`Active: ${activeBranchId || "(none)"}`);
  lines.push(`Total: ${openBranches}/${maxBranches} (${availableSlots} ${availableSlots === 1 ? "slot" : "slots"} available)`);
  return lines.join("\n");
}
