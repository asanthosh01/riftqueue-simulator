# Official benchmark artifacts

`official-benchmark-results.json` is the canonical synthetic output from the
four official scenarios in [`../benchmarks.md`](../benchmarks.md). It was
generated twice with `npm run benchmark:run`; the two JSON reports were
byte-for-byte identical.

The artifact is retained for technical review only. It does not interpret,
rank, or publish findings about a production matchmaking system.

`official-benchmark-validation.json` replays the same locked inputs with
paired trial-level metrics, Late-night / Balanced ablations, and the existing
threshold grid. It records raw differences and confidence intervals only; it
does not assign winners or publish conclusions.

Paired-difference intervals use a two-sided 95% Student's t interval for the
eight paired trials. The existing aggregate metric intervals are unchanged.

To regenerate the report locally:

```bash
npm run benchmark:run -- --output docs/results/official-benchmark-results.json
npm run benchmark:validate -- --output docs/results/official-benchmark-validation.json
```
