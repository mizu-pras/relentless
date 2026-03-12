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
