# Core Library

## Purpose
- Shared utilities for config loading, state persistence, and circuit-breaker protection.

## Key Files
- `config.ts`: JSONC config loading and merge order
- `state.ts`: `.relentless/` state, halt management, and agent assignments
- `shared-context.ts`: shared knowledge base for cross-agent context (project-map, conventions, decisions, errors, file-summaries, compression metrics)
- `doc-tracker.ts`: documentation dirty-tracking — marks docs as needing update when source files change, tracks dirty/resolved status
- `token-budget.ts`: proactive token budget forecasting — cost estimation, dispatch forecasting, compaction recommendations, cost tracking persistence
- `routing.ts`: learning-based agent routing — records dispatch outcomes, computes routing suggestions from historical performance data
- `circuit-breaker.ts`: runaway-loop protection (5-layer)
- `compaction.ts`: differential compaction — tracks state changes between compactions and only injects deltas
- `lessons.ts`: persistent agent learning system — extracts, categorizes, and stores lessons from resolved errors across pursuits
- `metrics.ts`: pursuit analytics — computes metrics from archived pursuits and lessons (pursuit completion, agent performance, error patterns)
- `*.test.ts`: unit tests for each module (`config.test.ts`, `state.test.ts`, `circuit-breaker.test.ts`, `shared-context.test.ts`, `token-budget.test.ts`, `compaction.test.ts`, `doc-tracker.test.ts`, `lessons.test.ts`, `metrics.test.ts`, `routing.test.ts`)

## Commands
- `npm run build` — compile via `tsc -p lib/tsconfig.json`
- `npm test` — build + run all test files

## Config Behavior
- Merge order: defaults -> user -> project
- Sources:
  - `defaults.jsonc`
  - `~/.config/opencode/relentless.jsonc`
  - `.opencode/relentless.jsonc`
- JSONC comments and trailing commas are accepted.

## Chunk Gate
- Configurable via `chunk_gate` key in config
- Default commands: `tsc --noEmit`, `npm run build`, `npm test`
- Enforced by pursuit loop after each chunk completion

## Time Budget
- Configurable via `time_budget` key in config
- Tracks feature vs fix ratio during pursuit
- Alerts when fix ratio exceeds threshold (default: 20%)

## Token Budget
- Proactive forecasting: estimate dispatch costs BEFORE sending agents
- Dual thresholds: `proactive_threshold` (0.75) triggers compaction recommendation, `token_budget_threshold` (0.85) is the hard stop
- Cost model: handoff (300) + file reads (500/file) + tool calls (200/call) + skill loading (800) + response (2000)
- Plugin persists `token_usage` and `context_limit` to pursuit state for conductor to read
- Cost tracking: `DispatchRecord` and `TokenTracking` types persist per-dispatch estimated and actual token costs
- `recordDispatchCost()` and `updateActualCost()` maintain running totals
- `formatCostSummary()` renders per-agent cost breakdown
- `PursuitState.token_tracking` persists cost data across session; archived for historical analysis

## Circuit Breaker Notes
- Classifies known failure types (token limits, rate limits, etc.)
- Tracks consecutive failures to trigger stop conditions
- Applies injection throttling to prevent runaway retries
- Monitors token budget and dead-session signals

## Shared Context
- Lives in `.relentless/shared-context/` — project-local, pursuit-scoped
- Markdown channels (overwrite): `project-map.md`, `conventions.md`
- JSONL channels (append-only): `decisions.jsonl`, `error-log.jsonl`
- JSONL channel (upsert): `file-summaries.jsonl` — per-file summaries for handoff compression
- Auto-cleared when pursuit is archived via `archiveCompleted()`
- Included in session compaction via `formatSharedContext()`
- File summaries formatted for handoffs via `formatSummariesForHandoff()`
- Compression metrics tracked: hits/misses/tokens-saved via `getCompressionMetrics()`

## Documentation Dirty Tracking
- Tracks which documentation files need updating after code changes
- JSONL storage at `.relentless/shared-context/doc-dirty.jsonl`
- Convention-based: when `lib/*.ts` changes -> `lib/AGENTS.md` and `README.md` are marked dirty
- Configurable patterns in `defaults.jsonc` under `doc_tracker.patterns`
- Integrated into `formatSharedContext()` — agents see dirty docs in their context
- Used by verification-before-completion skill to check docs before claiming done

## Differential Compaction
- First compaction: full state dump (task, all todos, circuit breaker)
- Subsequent compactions: only changed todos (status deltas), new/removed todos, circuit breaker changes
- Snapshot stored in `.relentless/last-compaction.json`
- Fallback: if compaction module fails, plugin uses a minimal inline format
- Token savings: ~30-50% reduction on repeated compactions during long pursuits

## Agent Learning System (Lessons)
- Persistent storage at `.relentless/lessons.jsonl` — survives pursuit archive (NOT in shared-context/)
- When a pursuit is archived, `archiveCompleted()` extracts lessons from `error-log.jsonl` before clearing
- Only errors with resolutions become lessons; unresolved errors are ignored
- Lessons are categorized: `type_error`, `import_error`, `config_error`, `test_failure`, `build_error`, `runtime_error`, `pattern`, `convention`, `agent_performance`, `other`
- Framework gotchas: `framework_gotcha` category for recurring build/framework issues
- `getGotchasForStack()` queries lessons relevant to a project's tech stack
- Error patterns are normalized (file paths, line numbers, quoted values stripped) for deduplication
- Duplicate patterns merge: frequency increments, agents/examples accumulate, longer resolution wins
- Lessons injected into: system prompt (via plugin), `formatSharedContext()`, and agent handoffs
- `formatLessonsForHandoff()` filters lessons relevant to assigned files, falls back to top 3 general lessons
- Configurable via `defaults.jsonc` under `lessons` key

## Global Lessons (Cross-Project Sharing)
- Global store at `~/.config/opencode/relentless/global-lessons.jsonl`
- `readGlobalLessons()` and `writeGlobalLessons()` — global JSONL I/O (optional `globalDir` param for testing)
- `promoteToGlobal()` — promotes project lessons to global when frequency >= 3, skips `agent_performance` category
- `mergeGlobalLessons()` — returns global lessons relevant to current project's tech stack
- Opt-in via `lessons.share_globally: false` in config (default off)
- Plugin injects global lessons under `<RELENTLESS_GLOBAL_LESSONS>` tag when sharing enabled
- Existing project-local lesson behavior unchanged

## Smart Agent Routing
- `routing.ts` provides learning-based agent selection
- Records dispatch outcomes as `agent_performance` lessons in lessons.jsonl
- Pattern format: `agent_routing:<category>:<agent>` with success rate in resolution field
- `getRoutingSuggestion()` returns static default unless learning enabled AND N>=5 data points show better agent
- `getAllRoutingSuggestions()` covers all standard routing categories
- `formatRoutingSuggestions()` only emits content when actual overrides exist (saves tokens)
- Opt-in via `routing.learning_enabled: false` in config (default off)
- Configurable threshold: `routing.min_data_points: 5`

## Implementation Conventions
- Prefer lazy or dynamic imports where resilience is needed
- Keep config/state helpers side-effect-light and deterministic
- Treat `.relentless/halt` as a hard stop signal before actions

## Metrics (Pursuit Analytics)
- Computes analytics from `.relentless/history/` archives and `.relentless/lessons.jsonl`
- Metrics: pursuit completion rates, agent dispatch/success rates, error category patterns, cost analytics
- Four interfaces: `PursuitMetrics`, `AgentMetrics`, `ErrorMetrics`, `CostMetrics` composed into `FullMetrics`
- Cost analytics: aggregates `token_tracking` from archived pursuits — total estimated/actual, per-agent breakdown, per-pursuit averages
- Two formatters: `formatMetricsSummary()` (compact table), `formatMetricsDetailed()` (expanded sections) — both include cost sections
- Handles gracefully: no history, corrupted archives, missing lessons, todos without agent fields, missing token_tracking

## Plugin Integration Tests
- `.opencode/plugins/relentless.test.ts` — tests all plugin hooks with real state/lessons/compaction
- Run via `npm run test:plugin` (separate from lib tests due to different tsconfig)
- Tests: config hook, chat.message rewrite, system transform injection, compaction fallback, event tracking, path traversal guards
