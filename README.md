# RiftQueue

RiftQueue is a full-stack discrete-event simulation for studying the tradeoff
between queue time and match quality in sparse, high-ELO matchmaking pools.

It compares two synthetic matchmaking strategies:

- **Baseline:** an expanding skill window with snake-draft team assignment.
- **Tail-Aware:** protects scarce players at the edges of the MMR distribution
  and searches for a lower-cost 5v5 team split.

RiftQueue is inspired by competitive tactical shooters, but it does not use
Riot Games data, hidden MMR, production rules, or internal infrastructure. All
players, arrivals, ranks, and results are simulated.

## Why RiftQueue

I built RiftQueue after experiencing high-ELO ranked lobbies that could feel
inconsistent even when their visible averages looked close. It is a synthetic
way to explore questions about late-night populations, queue-time tradeoffs,
individual skill spread, and whether Tail-Aware selection improves lobby
quality. It does not reproduce or make claims about Riot's proprietary
matchmaking.

## Current Result

Under the default simulated scenario, Tail-Aware reduced the bad-match rate
from **39.9% to 19.6%** while adding **9 seconds** to median queue time.

This is a simulation result, not a claim about a production matchmaking system.

## Product Surface

- **Overview:** concise project story and headline findings.
- **Simulator:** configure population, traffic, queue policy, and matcher.
- **Experiments:** scenario sweep, ablation, sensitivity, Pareto, oracle, and
  scale studies.
- **Saved Runs:** reopen reproducible runs and export JSON or CSV.
- **Methodology:** assumptions, algorithms, metrics, and interpretation limits.

## Architecture

```mermaid
flowchart TD
    A[Seeded player arrivals] --> B[Expanding queue]
    B --> C{Matcher}
    C --> D[Baseline]
    C --> E[Tail-Aware]
    D --> F[5v5 lobby]
    E --> F
    F --> G[Metrics and confidence intervals]
    G --> H[(D1 saved runs)]
```

See [`docs/architecture.md`](docs/architecture.md) for the route map, data flow,
and trust boundaries.

## Technology

- TypeScript, React 19, and Next-compatible routing through Vinext
- Cloudflare Workers and D1
- Drizzle ORM
- Tailwind CSS and Radix UI primitives
- Node's built-in test runner

## Run Locally

Requirements: Node.js `>=22.13.0`.

```bash
npm ci
npm run dev
```

Open the local URL printed by Vite.

Apply and inspect the local D1 database before starting a migration-dependent
workflow:

```bash
npm run db:migrate:local
npm run db:inspect:local
```

These commands use the checked-in local Wrangler configuration, the existing
Drizzle migrations, and ignored `.wrangler/` state. They use a placeholder
database ID and are intentionally local-only; they do not access a remote D1
database or change Site deployment settings.

Experiment creation is rate-limited server-side. Configure these Worker secrets
and variables in the deployment environment (or `.dev.vars` locally):

```text
EXPERIMENT_RATE_LIMIT_SECRET=<long-random-secret>
EXPERIMENT_RATE_LIMIT_MAX_REQUESTS=3
EXPERIMENT_RATE_LIMIT_WINDOW_SECONDS=300
```

The limit and window default to 3 requests per 300 seconds. Missing or invalid
rate-limit configuration returns `503` rather than running without abuse
protection. Client addresses are HMAC-derived into an opaque D1 bucket key and
are never stored or returned. If `CF-Connecting-IP` is absent, requests share
an `unknown-client` bucket; do not remove that Cloudflare edge header unless
this shared fallback is acceptable.

## Validate Changes

Linux or Codex cloud:

```bash
npm run lint
npm test
```

macOS or another environment without GNU `timeout`:

```bash
npm run lint
npm run test:local
```

`npm test` uses the bounded Sites build wrapper. `npm run test:local` invokes
the portable Vinext build command directly.

## Repository Map

```text
app/                         Routes and API handlers
components/                  Shared interface and simulation workspace
lib/matchmaking.ts           Simulation and experimental algorithms
db/                          D1 schema and access layer
drizzle/                     Database migrations
tests/                       Engine, API, route, and UI regression tests
docs/architecture.md         System architecture and boundaries
ROADMAP.md                   Planned portfolio and research phases
```

## Reproducibility

Baseline and Tail-Aware receive the same seeded arrival stream within each
comparison. The default experiment aggregates eight independent trials of 500
matches and reports 95% confidence intervals. Saved runs retain their seed and
scenario settings and can be downloaded as JSON or CSV.

## Official Benchmark Plan

[`docs/benchmarks.md`](docs/benchmarks.md) defines four fixed, synthetic
scenarios for Peak, Late-night, Overnight, and late-night policy-tradeoff
comparisons. It specifies reproducible inputs and reporting metrics without
claiming or publishing production-game results.

## Project Status

The simulation engine, experimental studies, persistent runs, and five-route UI
are implemented. The next phase focuses on public-demo safeguards, deployment
portability, and portfolio documentation. See [`ROADMAP.md`](ROADMAP.md).

## License

No open-source license has been selected yet. All rights reserved until a
license is added.
