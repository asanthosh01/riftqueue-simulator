# RiftQueue Repository Guide

## Goal

Maintain RiftQueue as a rigorous, portfolio-grade high-ELO matchmaking
simulation. Treat all results as synthetic and never imply access to Riot Games'
private data, MMR, algorithms, or infrastructure.

## Start Here

Read these files before changing behavior:

- `README.md`
- `ROADMAP.md`
- `docs/architecture.md`
- `lib/matchmaking.ts`

## Commands

- Install: `npm ci`
- Develop: `npm run dev`
- Lint: `npm run lint`
- Linux/Codex cloud tests: `npm test`
- Portable/macOS tests: `npm run test:local`
- Generate a migration after schema changes: `npm run db:generate`

## Invariants

- Use seeded randomness for reproducible algorithm comparisons.
- Give Baseline and Tail-Aware the same player-arrival stream.
- A representative lobby must contain exactly two teams of five players.
- Population, traffic, and policy changes must affect the simulation inputs.
- Label every numerical result as simulated or synthetic where a reader could
  mistake it for production evidence.
- Preserve JSON and CSV compatibility for completed saved runs.
- Do not remove or rewrite an existing Drizzle migration after deployment.

## Change Expectations

- Add or update regression tests for behavior changes.
- Run lint and the appropriate full test command before committing.
- Keep the Overview concise; put interactive controls in Simulator and focused
  studies in Experiments.
- Update `docs/architecture.md` when routes, storage, or major data flow changes.
- Update `ROADMAP.md` when a phase is completed or reprioritized.
- Do not commit secrets, local Wrangler state, dependency folders, or generated
  build output.

## Deployment

The existing production Site is bound by `.openai/hosting.json` and uses the D1
binding `DB`. Repository work must not change site access from private to public
without explicit approval and public-demo safeguards.
