#!/usr/bin/env node

import { existsSync, readFileSync, readdirSync, statSync } from "fs";
import { join, resolve, dirname } from "path";
import { execSync } from "child_process";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
// Resolve lib/dist relative to this file's location (bin/dist/ -> lib/dist/)
const LIB_DIST = join(__dirname, "..", "..", "lib", "dist");

// CLI argument parser
interface CliOptions {
  command: string;
  headless: boolean;
  json: boolean;
  exitCode: boolean;
  projectDir: string;
  detailed: boolean;
  help: boolean;
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2);
  const opts: CliOptions = {
    command: "",
    headless: false,
    json: false,
    exitCode: false,
    projectDir: process.cwd(),
    detailed: false,
    help: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--headless") opts.headless = true;
    else if (arg === "--json") opts.json = true;
    else if (arg === "--exit-code") opts.exitCode = true;
    else if (arg === "--detailed") opts.detailed = true;
    else if (arg === "--help" || arg === "-h") opts.help = true;
    else if (arg === "--project-dir" && i + 1 < args.length) {
      opts.projectDir = resolve(args[++i]);
    } else if (!arg.startsWith("-") && !opts.command) {
      opts.command = arg;
    }
  }

  return opts;
}

const HELP_TEXT = `Usage: relentless <command> [options]

Commands:
  recon       Scan for AGENTS.md files and report coverage
  health      Run diagnostic health checks on installation
  verify      Run verification gate commands (typecheck, build, test)
  metrics     Display pursuit analytics and performance metrics

Options:
  --headless      Run without interactive prompts (default in CI)
  --json          Output in JSON format for machine consumption
  --exit-code     Exit with non-zero code on failures
  --detailed      Show detailed output (metrics only)
  --project-dir   Path to project directory (default: cwd)
  --help, -h      Show this help message
`;

interface CheckResult {
  name: string;
  status: "pass" | "fail" | "warn";
  detail: string;
}

interface CommandResult {
  command: string;
  status: "pass" | "fail";
  output: string;
  duration_ms: number;
}

async function loadJsoncModule(): Promise<{ parseJsonc: (text: string) => unknown }> {
  const jsoncPath = join(LIB_DIST, "jsonc.js");
  return await import(jsoncPath) as { parseJsonc: (text: string) => unknown };
}

// --- recon command ---
function runRecon(projectDir: string): { agents_files: string[]; missing: string[]; stale: string[] } {
  const agentsFiles: string[] = [];
  const missing: string[] = [];
  const stale: string[] = [];

  const dirsToCheck = ["lib", "commands", "skills", "agents", "bin", "templates"];

  for (const dir of dirsToCheck) {
    const dirPath = join(projectDir, dir);
    if (!existsSync(dirPath)) continue;

    const agentsPath = join(dirPath, "AGENTS.md");
    if (existsSync(agentsPath)) {
      agentsFiles.push(`${dir}/AGENTS.md`);

      // Check staleness: compare AGENTS.md mtime to newest file in dir
      try {
        const agentsMtime = statSync(agentsPath).mtimeMs;
        const entries = readdirSync(dirPath).filter((f) => f !== "AGENTS.md" && !f.startsWith("."));
        let newestMtime = 0;
        for (const entry of entries) {
          try {
            const entryMtime = statSync(join(dirPath, entry)).mtimeMs;
            if (entryMtime > newestMtime) newestMtime = entryMtime;
          } catch { /* skip unreadable entries */ }
        }
        if (newestMtime > agentsMtime) {
          stale.push(`${dir}/AGENTS.md`);
        }
      } catch { /* skip stat errors */ }
    } else {
      missing.push(dir);
    }
  }

  return { agents_files: agentsFiles, missing, stale };
}

// --- health command ---
async function runHealth(projectDir: string): Promise<CheckResult[]> {
  const checks: CheckResult[] = [];
  let parseJsonc: ((text: string) => unknown) | null = null;

  try {
    ({ parseJsonc } = await loadJsoncModule());
  } catch {
    parseJsonc = null;
  }

  // node_modules exists
  const nmPath = join(projectDir, "node_modules");
  checks.push({
    name: "node_modules",
    status: existsSync(nmPath) ? "pass" : "fail",
    detail: existsSync(nmPath) ? "node_modules directory exists" : "node_modules missing — run npm install",
  });

  // TypeScript installed
  const tscPath = join(nmPath, ".bin", "tsc");
  checks.push({
    name: "typescript",
    status: existsSync(tscPath) ? "pass" : "fail",
    detail: existsSync(tscPath) ? "tsc binary found" : "TypeScript not installed",
  });

  // Build output exists
  const distPath = join(projectDir, "lib", "dist");
  const distExists = existsSync(distPath);
  checks.push({
    name: "build_output",
    status: distExists ? "pass" : "warn",
    detail: distExists ? "lib/dist/ exists" : "lib/dist/ missing — run npm run build",
  });

  // Build freshness
  if (distExists) {
    try {
      const srcDir = join(projectDir, "lib");
      const srcFiles = readdirSync(srcDir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));
      let newestSrc = 0;
      for (const f of srcFiles) {
        const mtime = statSync(join(srcDir, f)).mtimeMs;
        if (mtime > newestSrc) newestSrc = mtime;
      }
      const distFiles = readdirSync(distPath).filter((f) => f.endsWith(".js"));
      let oldestDist = Infinity;
      for (const f of distFiles) {
        const mtime = statSync(join(distPath, f)).mtimeMs;
        if (mtime < oldestDist) oldestDist = mtime;
      }
      const fresh = oldestDist >= newestSrc;
      checks.push({
        name: "build_freshness",
        status: fresh ? "pass" : "warn",
        detail: fresh ? "Build output is up to date" : "Build output may be stale — run npm run build",
      });
    } catch {
      checks.push({ name: "build_freshness", status: "warn", detail: "Could not determine build freshness" });
    }
  }

  // Config file parses
  const configPath = join(projectDir, "defaults.jsonc");
  if (existsSync(configPath)) {
    try {
      const text = readFileSync(configPath, "utf8");
      if (!parseJsonc) {
        throw new Error("Could not load shared JSONC parser from lib/dist/jsonc.js");
      }
      parseJsonc(text);
      checks.push({ name: "config", status: "pass", detail: "defaults.jsonc parses successfully" });
    } catch (e) {
      checks.push({ name: "config", status: "fail", detail: `defaults.jsonc parse error: ${(e as Error).message}` });
    }
  }

  // State file valid
  const statePath = join(projectDir, ".relentless", "current-pursuit.json");
  if (existsSync(statePath)) {
    try {
      JSON.parse(readFileSync(statePath, "utf8"));
      checks.push({ name: "state", status: "pass", detail: "current-pursuit.json is valid JSON" });
    } catch {
      checks.push({ name: "state", status: "fail", detail: "current-pursuit.json is corrupted" });
    }
  } else {
    checks.push({ name: "state", status: "pass", detail: "No active pursuit (expected when idle)" });
  }

  return checks;
}

// --- verify command ---
function runVerify(projectDir: string): CommandResult[] {
  // Default gate commands
  const commands = ["npx tsc --noEmit -p lib/tsconfig.json", "npm run build", "npm test"];
  const results: CommandResult[] = [];

  for (const cmd of commands) {
    const start = Date.now();
    try {
      const output = execSync(cmd, { cwd: projectDir, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], timeout: 300_000 });
      results.push({ command: cmd, status: "pass", output: output.trim(), duration_ms: Date.now() - start });
    } catch (e: unknown) {
      const err = e as { stdout?: string; stderr?: string; message?: string; killed?: boolean };
      const timedOut = err.killed ? " (timed out after 5 minutes)" : "";
      const output = ((err.stdout || "") + (err.stderr || "") || err.message || "unknown error") + timedOut;
      results.push({ command: cmd, status: "fail", output: output.trim(), duration_ms: Date.now() - start });
    }
  }

  return results;
}

// --- metrics command ---
async function loadMetricsModule(): Promise<{
  computeMetrics: (dir?: string) => Record<string, unknown>;
  formatMetricsSummary: (m: Record<string, unknown>) => string;
  formatMetricsDetailed: (m: Record<string, unknown>) => string;
}> {
  const metricsPath = join(LIB_DIST, "metrics.js");
  // Dynamic import with computed path avoids TS static resolution
  return await import(metricsPath) as {
    computeMetrics: (dir?: string) => Record<string, unknown>;
    formatMetricsSummary: (m: Record<string, unknown>) => string;
    formatMetricsDetailed: (m: Record<string, unknown>) => string;
  };
}

async function runMetrics(projectDir: string, detailed: boolean): Promise<string | Record<string, unknown>> {
  try {
    const { computeMetrics, formatMetricsSummary, formatMetricsDetailed } = await loadMetricsModule();
    const metrics = computeMetrics(projectDir);
    return detailed ? formatMetricsDetailed(metrics) : formatMetricsSummary(metrics);
  } catch (e) {
    return `Error computing metrics: ${(e as Error).message}`;
  }
}

async function runMetricsJson(projectDir: string): Promise<Record<string, unknown>> {
  try {
    const { computeMetrics } = await loadMetricsModule();
    return computeMetrics(projectDir) as unknown as Record<string, unknown>;
  } catch (e) {
    return { error: (e as Error).message };
  }
}

// --- main ---
async function main(): Promise<void> {
  const opts = parseArgs(process.argv);

  if (opts.help || !opts.command) {
    console.log(HELP_TEXT);
    process.exit(opts.command ? 0 : 2);
  }

  try {
    switch (opts.command) {
      case "recon": {
        const result = runRecon(opts.projectDir);
        if (opts.json) {
          console.log(JSON.stringify(result, null, 2));
        } else {
          console.log("## Relentless Recon Report\n");
          console.log(`AGENTS.md files found: ${result.agents_files.length}`);
          for (const f of result.agents_files) console.log(`  ✓ ${f}`);
          if (result.missing.length) {
            console.log(`\nMissing AGENTS.md in: ${result.missing.length} directories`);
            for (const d of result.missing) console.log(`  ✗ ${d}/`);
          }
          if (result.stale.length) {
            console.log(`\nStale AGENTS.md files: ${result.stale.length}`);
            for (const f of result.stale) console.log(`  ⚠ ${f}`);
          }
        }
        if (opts.exitCode && result.missing.length > 0) process.exit(1);
        break;
      }

      case "health": {
        const checks = await runHealth(opts.projectDir);
        if (opts.json) {
          console.log(JSON.stringify({ checks }, null, 2));
        } else {
          console.log("## Relentless Health Check\n");
          for (const c of checks) {
            const icon = c.status === "pass" ? "✓" : c.status === "fail" ? "✗" : "⚠";
            console.log(`  ${icon} ${c.name}: ${c.detail}`);
          }
          const failed = checks.filter((c) => c.status === "fail").length;
          const warned = checks.filter((c) => c.status === "warn").length;
          console.log(`\n${checks.length} checks: ${checks.length - failed - warned} passed, ${failed} failed, ${warned} warnings`);
        }
        if (opts.exitCode && checks.some((c) => c.status === "fail")) process.exit(1);
        break;
      }

      case "verify": {
        const results = runVerify(opts.projectDir);
        if (opts.json) {
          console.log(JSON.stringify({ commands: results }, null, 2));
        } else {
          console.log("## Relentless Verification\n");
          for (const r of results) {
            const icon = r.status === "pass" ? "✓" : "✗";
            console.log(`  ${icon} ${r.command} (${r.duration_ms}ms)`);
          }
          const failed = results.filter((r) => r.status === "fail").length;
          console.log(`\n${results.length} commands: ${results.length - failed} passed, ${failed} failed`);
        }
        if (opts.exitCode && results.some((r) => r.status === "fail")) process.exit(1);
        break;
      }

      case "metrics": {
        if (opts.json) {
          const metrics = await runMetricsJson(opts.projectDir);
          console.log(JSON.stringify(metrics, null, 2));
        } else {
          const output = await runMetrics(opts.projectDir, opts.detailed);
          console.log(typeof output === "string" ? output : JSON.stringify(output, null, 2));
        }
        break;
      }

      default:
        console.error(`Unknown command: ${opts.command}`);
        console.error(`Run 'relentless --help' for usage.`);
        process.exit(2);
    }
  } catch (e) {
    if (opts.json) {
      console.error(JSON.stringify({ error: (e as Error).message }));
    } else {
      console.error(`Error: ${(e as Error).message}`);
    }
    process.exit(1);
  }
}

main();
