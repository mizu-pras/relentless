import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import { readLessons } from "./lessons.js";

interface ArchivedTodo {
  status?: string;
  agent?: string;
}

interface ArchivedPursuit {
  todos?: ArchivedTodo[];
  token_tracking?: {
    dispatches?: Array<{
      agent?: string;
      estimated_tokens?: number;
      actual_tokens?: number;
    }>;
    total_estimated?: number;
    total_actual?: number;
  };
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

export interface CostMetrics {
  total_estimated: number;
  total_actual: number;
  avg_estimated_per_pursuit: number;
  avg_actual_per_pursuit: number;
  agent_costs: Array<{ agent: string; estimated: number; actual: number; dispatches: number }>;
}

export interface FullMetrics {
  pursuit: PursuitMetrics;
  agents: AgentMetrics[];
  errors: ErrorMetrics;
  cost: CostMetrics;
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
  let totalEstimated = 0;
  let totalActual = 0;
  const agentCosts = new Map<string, { estimated: number; actual: number; dispatches: number }>();

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

    const tracking = pursuit.token_tracking;
    if (!tracking || typeof tracking !== "object") {
      continue;
    }

    totalEstimated += typeof tracking.total_estimated === "number" ? tracking.total_estimated : 0;
    totalActual += typeof tracking.total_actual === "number" ? tracking.total_actual : 0;

    const dispatches = Array.isArray(tracking.dispatches) ? tracking.dispatches : [];
    for (const dispatch of dispatches) {
      if (!dispatch.agent) continue;
      const existing = agentCosts.get(dispatch.agent) || { estimated: 0, actual: 0, dispatches: 0 };
      existing.estimated += typeof dispatch.estimated_tokens === "number" ? dispatch.estimated_tokens : 0;
      existing.actual += typeof dispatch.actual_tokens === "number" ? dispatch.actual_tokens : 0;
      existing.dispatches += 1;
      agentCosts.set(dispatch.agent, existing);
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

  const cost: CostMetrics = {
    total_estimated: totalEstimated,
    total_actual: totalActual,
    avg_estimated_per_pursuit: pursuits.length === 0 ? 0 : Number((totalEstimated / pursuits.length).toFixed(1)),
    avg_actual_per_pursuit: pursuits.length === 0 ? 0 : Number((totalActual / pursuits.length).toFixed(1)),
    agent_costs: Array.from(agentCosts.entries())
      .map(([agent, values]) => ({
        agent,
        estimated: values.estimated,
        actual: values.actual,
        dispatches: values.dispatches,
      }))
      .sort((a, b) => {
        if (b.estimated !== a.estimated) return b.estimated - a.estimated;
        return a.agent.localeCompare(b.agent);
      }),
  };

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
    cost,
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
  lines.push("");
  lines.push("## Cost Tracking");
  lines.push(
    `Tokens: ${metrics.cost.total_estimated.toLocaleString()} estimated, ${metrics.cost.total_actual.toLocaleString()} actual`,
  );
  lines.push(
    `Avg per pursuit: ${metrics.cost.avg_estimated_per_pursuit.toLocaleString()} estimated, ${metrics.cost.avg_actual_per_pursuit.toLocaleString()} actual`,
  );
  if (metrics.cost.agent_costs.length === 0) {
    lines.push("Top agents: none");
  } else {
    lines.push(
      `Top agents: ${metrics.cost.agent_costs
        .slice(0, 5)
        .map((entry) => `${entry.agent} (${entry.dispatches}, ~${entry.estimated.toLocaleString()} est, ${entry.actual.toLocaleString()} act)`)
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
  lines.push("");
  lines.push("### Cost Metrics");
  lines.push(`- Total estimated tokens: ${metrics.cost.total_estimated.toLocaleString()}`);
  lines.push(`- Total actual tokens: ${metrics.cost.total_actual.toLocaleString()}`);
  lines.push(`- Avg estimated per pursuit: ${metrics.cost.avg_estimated_per_pursuit.toLocaleString()}`);
  lines.push(`- Avg actual per pursuit: ${metrics.cost.avg_actual_per_pursuit.toLocaleString()}`);
  if (metrics.cost.agent_costs.length === 0) {
    lines.push("- Per-agent costs: none");
  } else {
    for (const costEntry of metrics.cost.agent_costs) {
      lines.push(
        `- ${costEntry.agent}: ${costEntry.dispatches} dispatches, ~${costEntry.estimated.toLocaleString()} estimated, ${costEntry.actual.toLocaleString()} actual`,
      );
    }
  }
  return lines.join("\n");
}
