# RiftQueue roadmap

RiftQueue is a VALORANT-inspired discrete-event simulation for investigating the
queue-time versus match-quality tradeoff in sparse, high-ELO matchmaking.

## Current phase

### Navigation and route structure

- [x] Create a persistent desktop and mobile navigation shell.
- [x] Add focused Overview, Simulator, Experiments, Saved Runs, and Methodology routes.
- [x] Preserve server-backed experiment execution, progress, saved runs, and exports.
- [x] Keep the validated simulation engine unchanged during the information-architecture refactor.
- [ ] Complete production regression testing and private deployment.

Production-readiness regression status: local D1 migration verification now uses
a checked-in Wrangler configuration, the existing Drizzle migrations, and
project-local ignored state. The exact next recommended task is to configure the
required production rate-limit secret, then request approval for a private
deployment and run the same experiment, saved-run, and export checks there.

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
