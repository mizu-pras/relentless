# Core Library

## Purpose
- Shared utilities for config loading, state persistence, and circuit-breaker protection.

## Key Files
- `config.ts`: JSONC config loading and merge order
- `state.ts`: `.relentless/` state, halt management, and agent assignments
- `shared-context.ts`: shared knowledge base for cross-agent context (project-map, conventions, decisions, errors, file-summaries)
- `token-budget.ts`: proactive token budget forecasting — cost estimation, dispatch forecasting, compaction recommendations
- `circuit-breaker.ts`: runaway-loop protection (5-layer)
- `compaction.ts`: differential compaction — tracks state changes between compactions and only injects deltas
- `*.test.ts`: unit tests for each module (`config.test.ts`, `state.test.ts`, `circuit-breaker.test.ts`, `shared-context.test.ts`, `token-budget.test.ts`, `compaction.test.ts`)

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

## Token Budget
- Proactive forecasting: estimate dispatch costs BEFORE sending agents
- Dual thresholds: `proactive_threshold` (0.75) triggers compaction recommendation, `token_budget_threshold` (0.85) is the hard stop
- Cost model: handoff (300) + file reads (500/file) + tool calls (200/call) + skill loading (800) + response (2000)
- Plugin persists `token_usage` and `context_limit` to pursuit state for conductor to read

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

## Differential Compaction
- First compaction: full state dump (task, all todos, circuit breaker)
- Subsequent compactions: only changed todos (status deltas), new/removed todos, circuit breaker changes
- Snapshot stored in `.relentless/last-compaction.json`
- Fallback: if compaction module fails, plugin uses a minimal inline format
- Token savings: ~30-50% reduction on repeated compactions during long pursuits

## Implementation Conventions
- Prefer lazy or dynamic imports where resilience is needed
- Keep config/state helpers side-effect-light and deterministic
- Treat `.relentless/halt` as a hard stop signal before actions
