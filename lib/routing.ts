import { readLessons, writeLessons, Lesson } from "./lessons.js";

export interface AgentPerformanceRecord {
  agent: string;
  task_category: string;
  success: boolean;
  retry_count: number;
  estimated_tokens: number;
  timestamp: string;
}

export interface RoutingSuggestion {
  category: string;
  default_agent: string;
  suggested_agent: string;
  confidence: number;
  data_points: number;
  reason: string;
}

const STATIC_ROUTING: Record<string, string> = {
  deep: "artisan",
  visual: "maestro",
  quick: "scout",
  reason: "sentinel",
  orchestrate: "conductor",
};

export function recordDispatch(projectDir: string | undefined, record: AgentPerformanceRecord): void {
  const existing = readLessons(projectDir);
  const pattern = `agent_routing:${record.task_category}:${record.agent}`;
  const id = generateRoutingLessonId(record.agent, record.task_category);
  const existingLesson = existing.find((lesson) => lesson.id === id);

  if (existingLesson) {
    existingLesson.frequency += 1;
    existingLesson.last_seen = record.timestamp;
    if (record.timestamp < existingLesson.first_seen) {
      existingLesson.first_seen = record.timestamp;
    }
    const [successes, total] = parseSuccessRate(existingLesson.resolution);
    const nextSuccesses = successes + (record.success ? 1 : 0);
    const nextTotal = total + 1;
    existingLesson.resolution = `${nextSuccesses}/${nextTotal}`;
    existingLesson.examples = [...existingLesson.examples.slice(-2), `retries:${record.retry_count},tokens:${record.estimated_tokens}`].slice(-3);
    writeLessons(projectDir, existing);
    return;
  }

  const newLesson: Lesson = {
    id,
    category: "agent_performance",
    pattern,
    resolution: record.success ? "1/1" : "0/1",
    frequency: 1,
    agents: [record.agent],
    examples: [`retries:${record.retry_count},tokens:${record.estimated_tokens}`],
    first_seen: record.timestamp,
    last_seen: record.timestamp,
    source_files: [],
  };
  existing.push(newLesson);
  writeLessons(projectDir, existing);
}

function generateRoutingLessonId(agent: string, category: string): string {
  const seed = `agent_performance:agent_routing:${category}:${agent}`.toLowerCase();
  let hash = 5381;
  for (let index = 0; index < seed.length; index++) {
    hash = ((hash << 5) + hash) ^ seed.charCodeAt(index);
    hash >>>= 0;
  }
  return `L-${hash.toString(16).padStart(8, "0").slice(0, 8)}`;
}

function parseSuccessRate(resolution: string): [number, number] {
  const match = resolution.match(/^(\d+)\/(\d+)$/);
  if (!match) return [0, 0];
  return [parseInt(match[1], 10), parseInt(match[2], 10)];
}

export function getRoutingSuggestion(
  projectDir: string | undefined,
  taskCategory: string,
  config?: { routing?: { learning_enabled?: boolean; min_data_points?: number } },
): RoutingSuggestion {
  const defaultAgent = STATIC_ROUTING[taskCategory] || "artisan";
  const learningEnabled = config?.routing?.learning_enabled ?? false;
  const minDataPoints = config?.routing?.min_data_points ?? 5;

  if (!learningEnabled) {
    return {
      category: taskCategory,
      default_agent: defaultAgent,
      suggested_agent: defaultAgent,
      confidence: 0,
      data_points: 0,
      reason: "Learning disabled - using static routing",
    };
  }

  const lessons = readLessons(projectDir);
  const performanceLessons = lessons.filter(
    (lesson) => lesson.category === "agent_performance" && lesson.pattern.startsWith(`agent_routing:${taskCategory}:`),
  );

  if (performanceLessons.length === 0) {
    return {
      category: taskCategory,
      default_agent: defaultAgent,
      suggested_agent: defaultAgent,
      confidence: 0,
      data_points: 0,
      reason: "No performance data - using static routing",
    };
  }

  let bestAgent = defaultAgent;
  let bestRate = -1;
  let bestTotal = 0;
  let totalDataPoints = 0;

  for (const lesson of performanceLessons) {
    const [successes, total] = parseSuccessRate(lesson.resolution);
    totalDataPoints += total;

    if (total < minDataPoints) {
      continue;
    }

    const rate = successes / total;
    if (rate > bestRate || (rate === bestRate && total > bestTotal)) {
      bestRate = rate;
      bestAgent = lesson.agents[0] || defaultAgent;
      bestTotal = total;
    }
  }

  if (bestRate < 0 || totalDataPoints < minDataPoints) {
    return {
      category: taskCategory,
      default_agent: defaultAgent,
      suggested_agent: defaultAgent,
      confidence: 0,
      data_points: totalDataPoints,
      reason: `Insufficient data (${totalDataPoints}/${minDataPoints} required) - using static routing`,
    };
  }

  const confidence = Math.min(1, bestTotal / (minDataPoints * 2));

  return {
    category: taskCategory,
    default_agent: defaultAgent,
    suggested_agent: bestAgent,
    confidence: Number(confidence.toFixed(2)),
    data_points: totalDataPoints,
    reason:
      bestAgent === defaultAgent
        ? `Default agent confirmed (${Math.round(bestRate * 100)}% success rate, ${bestTotal} dispatches)`
        : `${bestAgent} outperforms ${defaultAgent} (${Math.round(bestRate * 100)}% success rate, ${bestTotal} dispatches)`,
  };
}

export function getAllRoutingSuggestions(
  projectDir: string | undefined,
  config?: { routing?: { learning_enabled?: boolean; min_data_points?: number } },
): RoutingSuggestion[] {
  return Object.keys(STATIC_ROUTING).map((category) => getRoutingSuggestion(projectDir, category, config));
}

export function formatRoutingSuggestions(suggestions: RoutingSuggestion[]): string {
  const overrides = suggestions.filter((suggestion) => suggestion.suggested_agent !== suggestion.default_agent);
  if (overrides.length === 0) {
    return "";
  }

  const lines = overrides.map(
    (suggestion) => `- **${suggestion.category}**: ${suggestion.default_agent} -> ${suggestion.suggested_agent} (${suggestion.reason})`,
  );

  return `## Routing Overrides (Learning-Based)\n\n${lines.join("\n")}`;
}
