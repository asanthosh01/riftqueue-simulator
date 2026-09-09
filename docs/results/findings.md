# Official benchmark findings

## Executive summary

Across the five unique, locked synthetic configurations, Tail-Aware traded
longer median queue times for lower lobby spread, lower team-average MMR gap,
and lower bad-match rates. The clearest simulated tradeoff appeared in the
Late-night / Balanced configuration: an additional 10.95 seconds of median
queue time accompanied a 26.38 percentage-point reduction in the default
bad-match rate.

These are results from RiftQueue's seeded simulation, not observations of
Riot Games or any live matchmaking system. They do not use Riot data, hidden
MMR, production rules, player populations, or infrastructure.

## Configuration summary

Each value is the mean paired difference, **Tail-Aware minus Baseline**, across
eight locked trials of 500 completed synthetic matches per matcher. A positive
queue-time value means Tail-Aware waited longer; negative quality values mean a
lower value for Tail-Aware. The six report arms represent five unique
configurations because Late-night / Balanced appears both as its own scenario
and as one policy arm in the late-night policy comparison.

| Configuration | Population / traffic / policy | Median queue time (seconds) | Lobby spread (synthetic MMR) | Team gap (synthetic MMR) | Bad-match rate (percentage points) |
|---|---|---:|---:|---:|---:|
| Peak / Balanced | 100% / Peak / Balanced | +4.60 | -40.82 | -8.86 | -6.03 |
| Late-night / Fast Queue | 50% / Late / Fast Queue | +2.97 | -25.27 | -20.80 | -4.25 |
| Late-night / Balanced | 50% / Late / Balanced | +10.95 | -50.43 | -14.20 | -26.38 |
| Late-night / Competitive | 50% / Late / Competitive | +16.28 | -25.48 | -9.45 | -2.23 |
| Overnight / Balanced | 25% / Overnight / Balanced | +6.81 | -6.36 | -22.11 | -0.85 |

## Late-night / Balanced effect

The table below gives the paired effect sizes for the standalone Late-night /
Balanced configuration. The intervals are two-sided 95% Student's t confidence
intervals across the eight paired trials.

| Metric | Tail-Aware minus Baseline | 95% confidence interval |
|---|---:|---:|
| Median queue time | +10.95 seconds | +9.76 to +12.14 seconds |
| Lobby spread | -50.43 synthetic MMR | -53.43 to -47.43 synthetic MMR |
| Team gap | -14.20 synthetic MMR | -14.47 to -13.94 synthetic MMR |
| Bad-match rate | -26.38 percentage points | -28.33 to -24.42 percentage points |

## What the ablation separates

The Late-night / Balanced ablation holds the same synthetic arrivals and policy
constant while changing candidate selection and team balancing separately.
Candidate selection accounts for the queue-time, lobby-spread, and default
bad-match-rate changes: switching from Baseline to Tail-Aware with snake
balancing added 10.95 seconds, reduced spread by 50.43 synthetic MMR, and
reduced the default bad-match rate by 26.38 percentage points. Optimized
balancing primarily changes team gap: it reduced team gap by 14.06 synthetic
MMR for Baseline and 10.98 synthetic MMR for Tail-Aware, without changing queue
time, lobby spread, or the default bad-match rate in this simulation.

## Threshold sensitivity

The validation replayed all 16 predeclared combinations of the existing lobby
spread and team-gap thresholds. Every cell retained a lower synthetic
bad-match rate for Tail-Aware plus optimized balancing than for Baseline plus
snake balancing; each paired 95% confidence interval stayed below zero. These
thresholds were fixed before this analysis and were not tuned after seeing the
results.

## Overnight limitation

The Overnight / Balanced reduction was statistically consistent but practically
too small to prevent the simulation's matchmaking collapse: Tail-Aware reduced
the default bad-match rate by 0.85 percentage points (95% CI, -1.27 to -0.43),
while both matchers still flagged more than 90% of completed synthetic lobbies
as bad matches. This is a limitation of this synthetic, low-population model,
not a statement about any live game.

## Reproducibility and scope

The source data is the committed
[`official-benchmark-results.json`](official-benchmark-results.json) and
[`official-benchmark-validation.json`](official-benchmark-validation.json)
artifacts. The protocol, fixed seeds, policies, and quality thresholds are
defined in [`../benchmarks.md`](../benchmarks.md). This analysis does not change
matcher parameters, policies, seeds, thresholds, or benchmark artifacts.
