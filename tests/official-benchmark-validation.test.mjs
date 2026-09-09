import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const artifact = new URL(
  "../docs/results/official-benchmark-validation.json",
  import.meta.url,
);
const metrics = ["queueSeconds", "spread", "teamGap", "badMatchRate"];

function assertFiniteDifference(difference, label) {
  assert.ok(Number.isFinite(difference.mean), `${label} mean`);
  assert.ok(Number.isFinite(difference.confidence.low), `${label} CI low`);
  assert.ok(Number.isFinite(difference.confidence.high), `${label} CI high`);
  assert.equal(difference.trialDifferences.length, 8, `${label} trials`);
  for (const value of difference.trialDifferences) {
    assert.ok(Number.isFinite(value), `${label} trial value`);
  }
}

test("preserves paired official benchmark validation without conclusions", async () => {
  const report = JSON.parse(await readFile(artifact, "utf8"));

  assert.equal(report.schemaVersion, 1);
  assert.equal(report.officialArms.length, 6);
  assert.equal(report.lateNightBalancedSensitivity.cells.length, 16);
  assert.deepEqual(
    Object.keys(report.lateNightBalancedAblation.contrasts),
    [
      "candidateSelectionWithSnake",
      "candidateSelectionWithOptimized",
      "teamBalancingWithBaseline",
      "teamBalancingWithTailAware",
    ],
  );

  for (const arm of report.officialArms) {
    assert.equal(arm.trials.length, 8, `${arm.id} trials`);
    for (const metric of metrics) {
      assertFiniteDifference(arm.pairedDifferences[metric], `${arm.id} ${metric}`);
    }
    for (const trial of arm.trials) {
      assert.ok(Number.isFinite(trial.baseline.arrivalsConsumedBeforeTargetMatches));
      assert.ok(Number.isFinite(trial.adaptive.arrivalsConsumedBeforeTargetMatches));
    }
  }

  for (const contrast of Object.values(report.lateNightBalancedAblation.contrasts)) {
    for (const metric of metrics) {
      assertFiniteDifference(contrast.pairedDifferences[metric], `${contrast.comparison} ${metric}`);
    }
  }

  for (const cell of report.lateNightBalancedSensitivity.cells) {
    assert.equal(cell.baselineRates.length, 8);
    assert.equal(cell.adaptiveRates.length, 8);
    assertFiniteDifference(
      cell.adaptiveMinusBaseline,
      `${cell.spreadThreshold}/${cell.teamGapThreshold}`,
    );
  }
});
