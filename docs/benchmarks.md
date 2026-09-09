# RiftQueue benchmark plan

This plan defines four official, reproducible synthetic scenarios for comparing
queue-time and lobby-quality tradeoffs. It does not contain benchmark results
and does not model Riot Games' proprietary matchmaking.

## Common protocol

- Run the existing Baseline and Tail-Aware comparison for every scenario. The
  two matchers receive the same seeded arrival stream within each trial.
- Use base seed `20260904`. The eight trial seeds are the base seed plus
  `7,919` for each successive trial, matching `runExperimentSuite`.
- Run 8 trials of 500 completed matches each: 4,000 matches per matcher and
  scenario arm.
- Keep the current synthetic rank distribution, search-radius implementation,
  bad-match thresholds, and team balancers unchanged. Population and traffic
  are separate inputs: population is the configured pool level, while traffic
  changes synthetic arrival density.
- Compute every metric for each trial, then report the mean of the eight trial
  values with its existing 95% confidence interval. For median queue time,
  compute the player-wait median within each trial before aggregation.

## Automated runner

The runner encodes this plan without changing matcher behavior:

```bash
npm run benchmark:dry-run
npm run benchmark:run
```

`benchmark:dry-run` prints the six scenario-policy arms and writes nothing.
`benchmark:run` executes the fixed workload and writes one deterministic JSON
report to `outputs/benchmarks/official-benchmarks.json`. That output directory
is ignored by Git so generated results are reviewed and published separately;
running the command does not make a claim about a production matchmaking system.
Use `npm run benchmark:run -- --output path/to/report.json` to choose another
local destination.

### Arrival-consumption field

`playersGenerated` is a legacy result-field name. Its value is the number of
synthetic arrivals consumed before the target number of matches was completed;
it is not the total number of arrivals pre-generated for the trial. The paired
validation artifact labels this value `arrivalsConsumedBeforeTargetMatches`.

Paired validation differences use a two-sided 95% Student's t interval across
the eight locked trials. This is separate from the existing aggregate metric
intervals.

## Official scenarios

| ID | Scenario | Population | Traffic | Policy | Trials and matches |
|---|---|---:|---|---|---|
| `peak-balanced` | Peak population / Balanced policy | 100% | `peak` | `balanced` | 8 x 500 per matcher |
| `late-balanced` | Late-night population / Balanced policy | 50% | `late` | `balanced` | 8 x 500 per matcher |
| `overnight-balanced` | Overnight population / Balanced policy | 25% | `overnight` | `balanced` | 8 x 500 per matcher |
| `late-policy-tradeoff` | Late-night population / policy comparison | 50% | `late` | `fast`, `balanced`, `integrity` | 8 x 500 per matcher and policy |

For `late-policy-tradeoff`, use the same base seed and trial-seed sequence for
all three policy arms. That holds the generated arrivals constant across the
policy comparison; policy is the only intended input difference. In the UI and
reporting, label `fast` as **Fast Queue** and `integrity` as **Competitive**.

## Metrics to report

| Metric | Definition | Comparison |
|---|---|---|
| Median queue time | Median player wait in seconds within a trial | Lower is faster; report Tail-Aware minus Baseline and, in the policy scenario, each policy versus Balanced. |
| Lobby spread | Mean within-lobby MMR range across completed matches | Lower indicates a tighter skill range. |
| Team gap | Mean absolute difference between the two team-average MMR values | Lower indicates more even team averages. |
| Bad-match rate | Percentage of completed matches above the current lobby-spread or team-gap threshold | Lower indicates fewer matches failing the current synthetic quality rule. |

Each official comparison must show the four metrics for both matchers, the
absolute difference, and the 95% confidence interval. The policy scenario
should show the same table once per policy; it must not collapse the three
policies into one average.

## Interpretation guardrails

- Treat all values as simulated results from these fixed inputs, not evidence
  about a live game or its players.
- Do not compare runs that use different seeds, trial counts, match counts, or
  quality thresholds as if they were official benchmark results.
- A lower team-average gap does not by itself prove a tight individual skill
  spread; report lobby spread alongside it.
- Use these scenarios for regression and tradeoff analysis, not for tuning a
  policy against the same scenarios without separately recording a held-out
  evaluation plan.
