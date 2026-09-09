# Official benchmark artifacts

`official-benchmark-results.json` is the canonical synthetic output from the
four official scenarios in [`../benchmarks.md`](../benchmarks.md). It was
generated twice with `npm run benchmark:run`; the two JSON reports were
byte-for-byte identical.

The artifact is retained for technical review only. It does not interpret,
rank, or publish findings about a production matchmaking system.

To regenerate the report locally:

```bash
npm run benchmark:run -- --output docs/results/official-benchmark-results.json
```
