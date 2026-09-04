import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test from "node:test";

const root = fileURLToPath(new URL("..", import.meta.url));
const runFile = promisify(execFile);

test("prints the six fixed official benchmark arms without simulating", async () => {
  const { stdout } = await runFile(
    process.execPath,
    ["--experimental-strip-types", "scripts/run-benchmarks.mjs", "--dry-run"],
    { cwd: root },
  );
  const preview = JSON.parse(stdout);

  assert.equal(preview.schemaVersion, 1);
  assert.equal(preview.baseSeed, 20_260_904);
  assert.equal(preview.runsPerArm, 8);
  assert.equal(preview.matchesPerRun, 500);
  assert.equal(preview.arms.length, 6);
  assert.deepEqual(
    preview.arms.map((arm) => arm.id),
    [
      "peak-balanced",
      "late-balanced",
      "overnight-balanced",
      "late-policy-tradeoff-fast",
      "late-policy-tradeoff-balanced",
      "late-policy-tradeoff-integrity",
    ],
  );
  assert.match(preview.outputPath, /outputs\/benchmarks\/official-benchmarks\.json$/);
});
