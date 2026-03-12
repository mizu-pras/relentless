---
name: metrics
description: "Generate pursuit analytics and performance metrics from archived pursuits and lessons"
---

# Metrics - Pursuit Analytics

Analyze archived pursuits, agent completion trends, and learned error patterns.

## Modes

| Flag | Behavior | Default |
|------|----------|---------|
| `--summary` | Show concise analytics summary with key totals and top patterns | yes (default) |
| `--detailed` | Show full metrics breakdown with expanded sections | |
| `--json` | Output raw metrics object as JSON | |

## Input Handling

1. Parse `$ARGUMENTS` and select mode:
   - No arguments -> `--summary`
   - `--summary` -> summary mode
   - `--detailed` -> detailed mode
   - `--json` -> json mode
2. If multiple known flags are provided, prefer the most specific output mode in this order: `--json`, `--detailed`, `--summary`.
3. If arguments are invalid, explain valid usage and show the modes table.

## Data Sources

- Archived pursuits: `.relentless/history/*.json`
- Lessons store: `.relentless/lessons.jsonl`
- Metrics implementation: `lib/metrics.ts`

## Summary Mode (default)

1. Compute metrics using `computeMetrics(projectDir?)`.
2. Render terminal-friendly output with `formatMetricsSummary(metrics)`.
3. Show:
   - Total/completed pursuits and completion rate
   - Total/completed todos and average todos per pursuit
   - Agent dispatch/completion table
   - Lessons totals and top error categories

## Detailed Mode

1. Compute metrics using `computeMetrics(projectDir?)`.
2. Render expanded output with `formatMetricsDetailed(metrics)`.
3. Include generated timestamp plus detailed sections for pursuit, agent, and error metrics.

## JSON Mode

1. Compute metrics using `computeMetrics(projectDir?)`.
2. Output the `FullMetrics` object as pretty JSON.
3. Do not add narrative text around the JSON payload.

## Error Handling

| Condition | Behavior |
|-----------|----------|
| `.relentless/history/` missing | Return zeroed metrics; do not fail |
| Corrupted archive JSON | Skip invalid files and continue |
| Lessons file missing/invalid | Use empty lesson set and continue |
| Unknown flags | Show valid usage and mode table |

## Output Style

- Keep output compact and scan-friendly.
- Prefer tables for agent comparisons in summary mode.
- In detailed mode, use structured sections with explicit labels.
- Never fail the whole command because one archive file is malformed.
