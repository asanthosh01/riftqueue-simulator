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
- `docs/benchmarks.md`
- `lib/matchmaking.ts`

## Project Operating Loop

### When deciding what to do next

Whenever the user asks "what's next?", "continue", or something similar:

1. Inspect the current branch and working tree.
2. Read `AGENTS.md`, `ROADMAP.md`, `docs/architecture.md`, and
   `docs/benchmarks.md`.
3. Check the status of any active GitHub pull request.
4. Do not recommend work that is already completed or included in an open pull
   request.
5. Identify the highest-value unfinished task and explain it in simple terms
   before implementing it.

### Current project priority

1. Review and complete the current pull request.
2. Build an automated benchmark runner.
3. Generate reproducible benchmark results.
4. Analyze and publish defensible findings.
5. Improve how results are presented on the website.
6. Handle final deployment work only when the user explicitly decides to
   deploy.

### Completion checklist

At the end of every completed task:

1. Run lint and relevant tests.
2. Self-review the diff for blockers.
3. Update `ROADMAP.md` with what was completed and the exact next recommended
   task.
4. Update architecture or benchmark documentation if the design changed.
5. Commit and push to the appropriate feature branch.
6. Create or update a pull request.
7. Never merge or deploy without the user's explicit approval.
8. Never invent simulation results or claim RiftQueue reproduces Riot's
   proprietary matchmaking.
9. Do not create a status-only pull request after a merge. Record roadmap
   status in the active feature pull request or the next substantive feature
   pull request instead.

Keep explanations beginner-friendly and state what each technical change
accomplishes in plain English.

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
