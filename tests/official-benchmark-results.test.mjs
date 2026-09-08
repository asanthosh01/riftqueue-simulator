import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const artifact = new URL(
  "../docs/results/official-benchmark-results.json",
  import.meta.url,
);

const expectedArms = [
  ["peak-balanced", "peak-balanced", "Peak population / Balanced policy", 100, "peak", "balanced"],
  ["late-balanced", "late-balanced", "Late-night population / Balanced policy", 50, "late", "balanced"],
  ["overnight-balanced", "overnight-balanced", "Overnight population / Balanced policy", 25, "overnight", "balanced"],
  ["late-policy-tradeoff-fast", "late-policy-tradeoff", "Late-night population / policy comparison", 50, "late", "fast"],
  ["late-policy-tradeoff-balanced", "late-policy-tradeoff", "Late-night population / policy comparison", 50, "late", "balanced"],
  ["late-policy-tradeoff-integrity", "late-policy-tradeoff", "Late-night population / policy comparison", 50, "late", "integrity"],
];

test("preserves all official benchmark arms with finite synthetic metrics", async () => {
  const report = JSON.parse(await readFile(artifact, "utf8"));

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.baseSeed, 20_260_904);
  assert.equal(report.runsPerArm, 8);
  assert.equal(report.matchesPerRun, 500);
  assert.equal(report.results.length, expectedArms.length);

  for (const [index, [id, scenarioId, label, population, traffic, policy]] of expectedArms.entries()) {
    const result = report.results[index];
    assert.deepEqual(
      [
        result.id,
        result.scenarioId,
        result.label,
        result.population,
        result.traffic,
        result.policy,
      ],
      [id, scenarioId, label, population, traffic, policy],
    );

    for (const [key, algorithm] of [["baseline", "baseline"], ["adaptive", "tail-aware"]]) {
      const matcher = result.comparison[key];
      assert.equal(matcher.algorithm, algorithm);
      for (const metric of ["queueSeconds", "spread", "teamGap", "badMatchRate"]) {
        assert.ok(Number.isFinite(matcher[metric]), `${id} ${key} ${metric}`);
        assert.ok(Number.isFinite(matcher.confidence[metric].low), `${id} ${key} ${metric} low`);
        assert.ok(Number.isFinite(matcher.confidence[metric].high), `${id} ${key} ${metric} high`);
      }
    }
  }
});
