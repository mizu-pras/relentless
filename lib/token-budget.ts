/**
 * Estimated token costs for common operations.
 * These are conservative estimates (slightly over) to avoid underforecasting.
 */
export const TOKEN_COSTS = {
  /** Base cost of a handoff prompt (JSON schema + task description) */
  HANDOFF_PROMPT: 300,
  /** Skill loading cost (average skill size when invoked by agent) */
  SKILL_LOADING: 800,
  /** Average cost per file read via tool */
  FILE_READ: 500,
  /** Average cost per tool call (input + output) */
  TOOL_CALL: 200,
  /** Average response generation cost */
  RESPONSE_GENERATION: 2000,
  /** System prompt injection (bootstrap + catalog) */
  SYSTEM_PROMPT: 1700,
  /** Orchestration skills injection (intent-gate + todo-enforcer) during pursuit */
  ORCHESTRATION_SKILLS: 1050,
} as const;

export interface DispatchEstimate {
  /** Number of files the agent will likely read */
  fileReads: number;
  /** Number of tool calls estimated */
  toolCalls: number;
  /** Whether the agent will load skills */
  hasSkillLoading: boolean;
}

export interface BudgetForecast {
  /** Current token usage (from plugin tracking) */
  currentUsage: number;
  /** Context window limit for this model */
  contextLimit: number;
  /** Estimated additional tokens for the next dispatch */
  estimatedCost: number;
  /** Projected usage fraction after dispatch (0.0 to 1.0) */
  projectedUsage: number;
  /** Whether compaction is recommended before dispatch */
  shouldCompact: boolean;
  /** Human-readable summary */
  summary: string;
}

/** Record of a single agent dispatch's token cost. */
export interface DispatchRecord {
  agent: string;
  task_id: string;
  estimated_tokens: number;
  actual_tokens?: number;
  timestamp: string;
}

/**
 * Token tracking state persisted in PursuitState.
 *
 * Note: `total_actual` has two sources:
 * - The plugin sets it to the cumulative session token usage (session-level snapshot)
 * - `updateActualCost()` adds per-dispatch actual costs (dispatch-level sum)
 * Currently only the plugin writes this field. If `updateActualCost()` is used in the
 * future, ensure the plugin's session-level write does not overwrite dispatch-level sums.
 */
export interface TokenTracking {
  dispatches: DispatchRecord[];
  total_estimated: number;
  total_actual: number;
}

/**
 * Create a new empty token tracking state.
 */
export function createTokenTracking(): TokenTracking {
  return {
    dispatches: [],
    total_estimated: 0,
    total_actual: 0,
  };
}

/**
 * Record a dispatch's estimated cost.
 */
export function recordDispatchCost(
  tracking: TokenTracking,
  agent: string,
  taskId: string,
  estimate: DispatchEstimate,
): TokenTracking {
  const estimated = estimateDispatchCost(estimate);
  return {
    dispatches: [
      ...tracking.dispatches,
      {
        agent,
        task_id: taskId,
        estimated_tokens: estimated,
        timestamp: new Date().toISOString(),
      },
    ],
    total_estimated: tracking.total_estimated + estimated,
    total_actual: tracking.total_actual,
  };
}

/**
 * Update a dispatch record with actual token usage.
 */
export function updateActualCost(
  tracking: TokenTracking,
  taskId: string,
  actualTokens: number,
): TokenTracking {
  const dispatches = tracking.dispatches.map((dispatch) => {
    if (dispatch.task_id === taskId && dispatch.actual_tokens === undefined) {
      return { ...dispatch, actual_tokens: actualTokens };
    }
    return dispatch;
  });
  return {
    dispatches,
    total_estimated: tracking.total_estimated,
    total_actual: tracking.total_actual + actualTokens,
  };
}

/**
 * Format a cost summary for display.
 */
export function formatCostSummary(tracking: TokenTracking): string {
  if (tracking.dispatches.length === 0) {
    return "No dispatches recorded.";
  }

  const lines: string[] = [];
  lines.push(`Total estimated: ${tracking.total_estimated.toLocaleString()} tokens`);
  lines.push(`Total actual: ${tracking.total_actual.toLocaleString()} tokens`);
  lines.push(`Dispatches: ${tracking.dispatches.length}`);

  const agentCosts = new Map<string, { estimated: number; actual: number; count: number }>();
  for (const dispatch of tracking.dispatches) {
    const existing = agentCosts.get(dispatch.agent) || { estimated: 0, actual: 0, count: 0 };
    existing.estimated += dispatch.estimated_tokens;
    existing.actual += dispatch.actual_tokens || 0;
    existing.count += 1;
    agentCosts.set(dispatch.agent, existing);
  }

  lines.push("");
  lines.push("Per-agent:");
  for (const [agent, costs] of Array.from(agentCosts.entries()).sort((a, b) => b[1].estimated - a[1].estimated)) {
    lines.push(
      `  ${agent}: ${costs.count} dispatches, ~${costs.estimated.toLocaleString()} est, ${costs.actual.toLocaleString()} actual`,
    );
  }

  return lines.join("\n");
}

/**
 * Estimate the token cost of a single agent dispatch.
 */
export function estimateDispatchCost(estimate: DispatchEstimate): number {
  let cost = TOKEN_COSTS.HANDOFF_PROMPT;
  cost += estimate.fileReads * TOKEN_COSTS.FILE_READ;
  cost += estimate.toolCalls * TOKEN_COSTS.TOOL_CALL;
  if (estimate.hasSkillLoading) {
    cost += TOKEN_COSTS.SKILL_LOADING;
  }
  cost += TOKEN_COSTS.RESPONSE_GENERATION;
  return cost;
}

/**
 * Forecast budget usage and recommend whether to compact.
 *
 * @param currentUsage - Current cumulative token usage in this session
 * @param contextLimit - Model's context window size (e.g. 200000)
 * @param dispatches - Array of dispatch estimates for upcoming work
 * @param proactiveThreshold - Usage fraction at which compaction is recommended (default 0.75)
 */
export function forecastBudget(
  currentUsage: number,
  contextLimit: number,
  dispatches: DispatchEstimate[],
  proactiveThreshold = 0.75
): BudgetForecast {
  const estimatedCost = dispatches.reduce((sum, d) => sum + estimateDispatchCost(d), 0);

  // Guard: if contextLimit is 0 or negative, we can't calculate usage —
  // default to recommending compaction as the safe choice.
  if (contextLimit <= 0) {
    return {
      currentUsage,
      contextLimit,
      estimatedCost,
      projectedUsage: 1,
      shouldCompact: true,
      summary: `Budget warning: invalid context limit (${contextLimit}). Compact recommended as safety measure.`,
    };
  }

  const projectedUsage = (currentUsage + estimatedCost) / contextLimit;
  const shouldCompact = projectedUsage > proactiveThreshold;

  const usagePct = Math.round(projectedUsage * 100);
  const currentPct = Math.round((currentUsage / contextLimit) * 100);
  const summary = shouldCompact
    ? `Budget warning: ${currentPct}% used, projected ${usagePct}% after dispatch (threshold: ${Math.round(proactiveThreshold * 100)}%). Compact before dispatching.`
    : `Budget OK: ${currentPct}% used, projected ${usagePct}% after dispatch.`;

  return {
    currentUsage,
    contextLimit,
    estimatedCost,
    projectedUsage,
    shouldCompact,
    summary,
  };
}

/**
 * Quick check: should we compact before dispatching N agents with default estimates?
 * Convenience wrapper for simple cases.
 *
 * @param currentUsage - Current cumulative token usage
 * @param contextLimit - Model's context window size
 * @param agentCount - Number of agents to dispatch
 * @param avgFileReads - Average file reads per agent (default 3)
 * @param proactiveThreshold - Threshold fraction (default 0.75)
 */
export function shouldCompactBeforeDispatch(
  currentUsage: number,
  contextLimit: number,
  agentCount: number,
  avgFileReads = 3,
  proactiveThreshold = 0.75
): boolean {
  const dispatches: DispatchEstimate[] = Array.from({ length: agentCount }, () => ({
    fileReads: avgFileReads,
    toolCalls: 5,
    hasSkillLoading: true,
  }));
  const forecast = forecastBudget(currentUsage, contextLimit, dispatches, proactiveThreshold);
  return forecast.shouldCompact;
}
