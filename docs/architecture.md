# RiftQueue architecture

## Product surfaces

| Route | Responsibility |
|---|---|
| `/` | Recruiter-friendly project overview and key simulated findings |
| `/findings` | Recruiter-friendly presentation of the committed synthetic benchmark findings |
| `/simulator` | Primary 4,000-match experiment workflow and representative lobby |
| `/experiments` | Ablation, sensitivity, Pareto, oracle, scale, and scenario studies |
| `/runs` | Durable experiment history, reopening, and exports |
| `/methodology` | Model mechanics, assumptions, controls, and limitations |

## Experiment pipeline

1. A seeded generator creates individual players with hidden MMR, displayed rank,
   role, and arrival time.
2. Players enter a simulated queue and their acceptable search radius expands with
   wait time according to the selected queue policy.
3. Baseline and Tail-Aware candidate selectors receive identical arrival streams.
4. Snake or optimized balancing divides ten selected players into two teams of five.
5. The engine records queue time, lobby spread, team gap, and bad-match outcomes.
6. Eight independent trials are aggregated into means and 95% confidence intervals.
7. The local benchmark runner calls the same experiment suite for the official
   scenario arms and writes a deterministic JSON report outside version control.
8. The local validation runner replays those locked scenarios with paired trial
   metrics, ablation variants, and the existing threshold grid for review-only
   JSON output.
9. `POST /api/experiments` requires a client `Idempotency-Key` and applies a
   configurable, fixed-window rate limit before creating a run. D1 stores only
   HMAC-derived rate-limit and idempotency keys, never raw addresses or supplied
   keys. A unique D1 reservation is created before rate limiting, so concurrent
   duplicates return the same pending run without spending another rate-limit slot.
10. A first attempted experiment POST establishes an anonymous `HttpOnly` browser
    session and returns `428` without creating a record or using quota. The
    browser shares that initialization, then retries with the same idempotency
    key. D1 stores only an HMAC-derived ownership key, and list, detail, and
    export routes filter by it so visitors cannot access each other's runs.
11. Before an authenticated creation reserves a run, a bounded D1 cleanup batch
    removes terminal records past the configured retention window and abandoned
    `creating` reservations. The status-and-created-time index supports those
    predicates; `queued` and `running` records are never cleanup candidates.
12. Server routes stream progress, persist completed experiment records in D1, and
    generate JSON or CSV exports.

## Trust boundaries

- All population, rank-distribution, and search-expansion values are synthetic.
- RiftQueue does not use Riot Games' hidden MMR, concurrency, production rules, or
  internal infrastructure.
- Confidence intervals describe simulated variation; they are not confidence in
  accuracy against Riot's private production environment.

## Local D1 verification

`wrangler.jsonc` defines only the local `DB` binding used to apply the Drizzle
migrations in `drizzle/`. The `db:migrate:local` and
`db:inspect:local` package scripts keep their state under ignored `.wrangler/`
paths and use a placeholder database ID, so they cannot target the hosted D1
database. Site deployment bindings remain managed by `.openai/hosting.json`.

## Public-release boundary

The current deployment remains private until experiment creation is rate-limited,
anonymous history is isolated, retention is bounded, and the API has been reviewed
for abuse and cost controls.
