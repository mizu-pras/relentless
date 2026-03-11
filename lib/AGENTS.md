# Core Library

## Purpose
- Shared utilities for config loading, state persistence, and circuit-breaker protection.

## Key Files
- `config.js`: JSONC config loading and merge order
- `state.js`: `.relentless/` state and halt management
- `circuit-breaker.js`: runaway-loop protection

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
