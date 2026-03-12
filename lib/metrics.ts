import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { readLessons } from "./lessons.js";

interface ArchivedTodo {
  status?: string;
  agent?: string;
}

interface ArchivedPursuit {
  todos?: ArchivedTodo[];
}

export interface PursuitMetrics {
  total_pursuits: number;
  completed_pursuits: number;
  completion_rate: number;
  avg_todos_per_pursuit: number;
  total_todos: number;
  total_completed_todos: number;
}

export interface AgentMetrics {
  agent: string;
  dispatch_count: number;
  completed_count: number;
  success_rate: number;
}

export interface ErrorMetrics {
  total_errors: number;
  resolved_count: number;
  top_categories: Array<{ category: string; count: number }>;
}

export interface FullMetrics {
  pursuit: PursuitMetrics;
  agents: AgentMetrics[];
  errors: ErrorMetrics;
  generated_at: string;
}

function percentage(numerator: number, denominator: number): number {
  if (denominator === 0) return 0;
  return Number(((numerator / denominator) * 100).toFixed(1));
}

function formatPercent(value: number): string {
  return `${Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)}%`;
}

function readArchives(projectDir?: string): ArchivedPursuit[] {
  const historyDir = join(projectDir || ".", ".relentless", "history");
  if (!existsSync(historyDir)) return [];

  try {
    const files = readdirSync(historyDir).filter((file) => file.endsWith(".json"));
    const pursuits: ArchivedPursuit[] = [];
    for (const file of files) {
      try {
        const parsed = JSON.parse(readFileSync(join(historyDir, file), "utf8"));
        if (parsed && typeof parsed === "object") {
          pursuits.push(parsed as ArchivedPursuit);
        }
      } catch {
        continue;
      }
    }
    return pursuits;
  } catch {
    return [];
  }
}

export function computeMetrics(projectDir?: string): FullMetrics {
  const pursuits = readArchives(projectDir);

  let completedPursuits = 0;
  let totalTodos = 0;
  let totalCompletedTodos = 0;
  const agentCounts = new Map<string, { dispatch_count: number; completed_count: number }>();

  for (const pursuit of pursuits) {
    const todos = Array.isArray(pursuit.todos) ? pursuit.todos : [];
    totalTodos += todos.length;

    let allCompleted = true;
    for (const todo of todos) {
      if (todo.status === "completed") {
        totalCompletedTodos += 1;
      } else {
        allCompleted = false;
      }

      if (!todo.agent) continue;
      const existing = agentCounts.get(todo.agent) || { dispatch_count: 0, completed_count: 0 };
      existing.dispatch_count += 1;
      if (todo.status === "completed") {
        existing.completed_count += 1;
      }
      agentCounts.set(todo.agent, existing);
    }

    if (allCompleted) {
      completedPursuits += 1;
    }
  }

  const lessons = readLessons(projectDir);
  const categoryCounts = new Map<string, number>();
  let resolvedCount = 0;

  for (const lesson of lessons) {
    if (lesson.resolution && lesson.resolution.trim().length > 0) {
      resolvedCount += 1;
    }
    categoryCounts.set(lesson.category, (categoryCounts.get(lesson.category) || 0) + 1);
  }

  const agents: AgentMetrics[] = Array.from(agentCounts.entries())
    .map(([agent, counts]) => ({
      agent,
      dispatch_count: counts.dispatch_count,
      completed_count: counts.completed_count,
      success_rate: percentage(counts.completed_count, counts.dispatch_count),
    }))
    .sort((a, b) => {
      if (b.dispatch_count !== a.dispatch_count) return b.dispatch_count - a.dispatch_count;
      return a.agent.localeCompare(b.agent);
    });

  const topCategories = Array.from(categoryCounts.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => {
      if (b.count !== a.count) return b.count - a.count;
      return a.category.localeCompare(b.category);
    });

  const pursuit: PursuitMetrics = {
    total_pursuits: pursuits.length,
    completed_pursuits: completedPursuits,
    completion_rate: percentage(completedPursuits, pursuits.length),
    avg_todos_per_pursuit: pursuits.length === 0 ? 0 : Number((totalTodos / pursuits.length).toFixed(1)),
    total_todos: totalTodos,
    total_completed_todos: totalCompletedTodos,
  };

  return {
    pursuit,
    agents,
    errors: {
      total_errors: lessons.length,
      resolved_count: resolvedCount,
      top_categories: topCategories,
    },
    generated_at: new Date().toISOString(),
  };
}

export function formatMetricsSummary(metrics: FullMetrics): string {
  const lines: string[] = [];
  lines.push("## Pursuit Analytics");
  lines.push("");
  lines.push(
    `Pursuits: ${metrics.pursuit.total_pursuits} total, ${metrics.pursuit.completed_pursuits} completed (${formatPercent(metrics.pursuit.completion_rate)})`,
  );
  lines.push(
    `Todos: ${metrics.pursuit.total_todos} total, ${metrics.pursuit.total_completed_todos} completed (avg ${metrics.pursuit.avg_todos_per_pursuit}/pursuit)`,
  );
  lines.push("");
  lines.push("## Agent Performance");
  lines.push("| Agent | Dispatches | Completed | Rate |");
  lines.push("|-------|------------|-----------|------|");
  if (metrics.agents.length === 0) {
    lines.push("| (none) | 0 | 0 | 0% |");
  } else {
    for (const agent of metrics.agents) {
      lines.push(
        `| ${agent.agent} | ${agent.dispatch_count} | ${agent.completed_count} | ${formatPercent(agent.success_rate)} |`,
      );
    }
  }
  lines.push("");
  lines.push("## Error Patterns");
  lines.push(`${metrics.errors.total_errors} lessons learned, ${metrics.errors.resolved_count} resolved`);
  if (metrics.errors.top_categories.length === 0) {
    lines.push("Top: none");
  } else {
    lines.push(
      `Top: ${metrics.errors.top_categories
        .slice(0, 5)
        .map((entry) => `${entry.category} (${entry.count})`)
        .join(", ")}`,
    );
  }
  return lines.join("\n");
}

export function formatMetricsDetailed(metrics: FullMetrics): string {
  const lines: string[] = [];
  lines.push("## Pursuit Analytics (Detailed)");
  lines.push("");
  lines.push(`Generated: ${metrics.generated_at}`);
  lines.push("");
  lines.push("### Pursuit Metrics");
  lines.push(`- Total pursuits: ${metrics.pursuit.total_pursuits}`);
  lines.push(`- Completed pursuits: ${metrics.pursuit.completed_pursuits}`);
  lines.push(`- Completion rate: ${formatPercent(metrics.pursuit.completion_rate)}`);
  lines.push(`- Total todos: ${metrics.pursuit.total_todos}`);
  lines.push(`- Completed todos: ${metrics.pursuit.total_completed_todos}`);
  lines.push(`- Average todos per pursuit: ${metrics.pursuit.avg_todos_per_pursuit}`);
  lines.push("");
  lines.push("### Agent Metrics");
  if (metrics.agents.length === 0) {
    lines.push("- No agent assignment data available.");
  } else {
    for (const agent of metrics.agents) {
      lines.push(
        `- ${agent.agent}: ${agent.completed_count}/${agent.dispatch_count} completed (${formatPercent(agent.success_rate)})`,
      );
    }
  }
  lines.push("");
  lines.push("### Error Metrics");
  lines.push(`- Total lessons: ${metrics.errors.total_errors}`);
  lines.push(`- Resolved lessons: ${metrics.errors.resolved_count}`);
  if (metrics.errors.top_categories.length === 0) {
    lines.push("- Top categories: none");
  } else {
    lines.push(
      `- Top categories: ${metrics.errors.top_categories
        .slice(0, 10)
        .map((entry) => `${entry.category} (${entry.count})`)
        .join(", ")}`,
    );
  }
  return lines.join("\n");
}
