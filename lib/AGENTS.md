# Core Library

## Purpose
- Shared utilities for config loading, state persistence, and circuit-breaker protection.

## Key Files
- `config.ts`: JSONC config loading and merge order
- `state.ts`: `.relentless/` state and halt management
- `circuit-breaker.ts`: runaway-loop protection (5-layer)
- `*.test.ts`: unit tests for each module (`config.test.ts`, `state.test.ts`, `circuit-breaker.test.ts`)

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

## Circuit Breaker Notes
- Classifies known failure types (token limits, rate limits, etc.)
- Tracks consecutive failures to trigger stop conditions
- Applies injection throttling to prevent runaway retries
- Monitors token budget and dead-session signals

## Implementation Conventions
- Prefer lazy or dynamic imports where resilience is needed
- Keep config/state helpers side-effect-light and deterministic
- Treat `.relentless/halt` as a hard stop signal before actions
