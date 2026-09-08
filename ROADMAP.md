# RiftQueue roadmap

RiftQueue is a VALORANT-inspired discrete-event simulation for investigating the
queue-time versus match-quality tradeoff in sparse, high-ELO matchmaking.

## Current phase

### Automated benchmark runner

- [x] Review and merge [PR #3](https://github.com/asanthosh01/riftqueue/pull/3).
- [x] Build an automated benchmark runner for the four official scenarios in
  [`docs/benchmarks.md`](docs/benchmarks.md).
- [x] Review [PR #4](https://github.com/asanthosh01/riftqueue/pull/4); it is
  clean and awaiting explicit merge approval.
- [ ] Generate reproducible benchmark results from the fixed scenario inputs.
- [ ] Analyze the results and publish defensible synthetic findings.
- [ ] Improve the website presentation of the published benchmark findings.

The benchmark plan and runner are complete. The exact next recommended task is
to request explicit approval to merge PR #4. After it is merged, generate the
reproducible benchmark reports before publishing any findings.

## Completed foundation

### Navigation and route structure

- [x] Create a persistent desktop and mobile navigation shell.
- [x] Add focused Overview, Simulator, Experiments, Saved Runs, and Methodology routes.
- [x] Preserve server-backed experiment execution, progress, saved runs, and exports.
- [x] Keep the validated simulation engine unchanged during the information-architecture refactor.

Production-readiness regression status: local D1 migration verification now uses
a checked-in Wrangler configuration, the existing Drizzle migrations, and
project-local ignored state.

Project-story update: the Overview and Methodology now explain the high-ELO
player motivation behind RiftQueue and state the experiment questions without
claiming access to proprietary matchmaking.

Benchmark-plan update: [`docs/benchmarks.md`](docs/benchmarks.md) defines four
official reproducible synthetic scenarios and their reporting protocol.

## Deferred until deployment approval

- [ ] Configure the production rate-limit secret and request approval for a
  private deployment.
- [ ] Run experiment creation, saved-run, and export regression checks in the
  private deployment.

## Next phase

### Public-demo hardening

- [x] Add server-side rate limiting for anonymous experiment creation.
- [ ] Add idempotency protection for duplicate run requests.
- [ ] Scope public saved-run history so visitors do not share one noisy global feed.
- [ ] Add bounded retention for completed and failed experiment records.
- [ ] Audit API errors, response sizes, and expensive inputs.
- [ ] Complete the public-release checklist before changing site access.

## Portfolio phase

- [ ] Create a public GitHub repository.
- [ ] Add GitHub Actions for build, lint, simulation invariants, and API tests.
- [ ] Write the recruiter-facing README and technical case study.
- [ ] Add a concise architecture diagram and reproducibility instructions.
- [ ] Pin the repository and add the public demo to the portfolio and resume.

## Research backlog

- [ ] Queue-time and lobby-quality distributions rather than averages alone.
- [ ] Rank-stratified results for Ascendant, Immortal, and Radiant players.
- [ ] Separate parameter-tuning scenarios from held-out evaluation scenarios.
- [ ] Parties, ping, region, role preferences, queue abandonment, and rematch constraints.
- [ ] True asynchronous workers with retries, cancellation, and heartbeats.

## Definition of done for each change

- The relevant user workflow works from navigation to result.
- Simulation invariants and API tests pass.
- Build and lint pass.
- Results remain clearly labeled as synthetic simulation outputs.
- Documentation is updated when behavior, architecture, or assumptions change.
