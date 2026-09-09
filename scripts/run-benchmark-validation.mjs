import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MATCHES_PER_RUN,
  REVIEW_METRICS,
  RUN_COUNT,
  SENSITIVITY_SPREAD_THRESHOLDS,
  SENSITIVITY_TEAM_GAP_THRESHOLDS,
  pairedDifference,
  runAblationTrials,
  runExperimentTrials,
} from "../lib/matchmaking.ts";
import { officialBenchmarkArms } from "./run-benchmarks.mjs";

const DEFAULT_OUTPUT_PATH = "outputs/benchmarks/official-benchmark-validation.json";

function usage() {
  return "Usage: npm run benchmark:validate [-- --output <path>]";
}

function parseArguments(args) {
  let outputPath = DEFAULT_OUTPUT_PATH;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument !== "--output") {
      throw new Error(`Unknown argument: ${argument}\n${usage()}`);
    }
    const next = args[index + 1];
    if (!next || next.startsWith("--")) {
      throw new Error("--output requires a path.\n" + usage());
    }
    outputPath = next;
    index += 1;
  }

  return resolve(outputPath);
}

function trialMetrics(result) {
  return {
    medianQueueSeconds: result.queueSeconds,
    lobbySpread: result.spread,
    teamGap: result.teamGap,
    badMatchRate: result.badMatchRate,
    arrivalsConsumedBeforeTargetMatches: result.playersGenerated,
  };
}

function pairedMetrics(reference, comparison) {
  return Object.fromEntries(
    REVIEW_METRICS.map((metric) => [
      metric,
      pairedDifference(
        reference.map((result) => result[metric]),
        comparison.map((result) => result[metric]),
      ),
    ]),
  );
}

function serializeExperimentArm(arm) {
  const trials = runExperimentTrials(arm);
  const baseline = trials.map((trial) => trial.baseline);
  const adaptive = trials.map((trial) => trial.adaptive);

  return {
    ...arm,
    pairedDifferenceConvention: "Tail-Aware minus Baseline",
    trials: trials.map((trial) => ({
      trial: trial.trial,
      seed: trial.seed,
      baseline: trialMetrics(trial.baseline),
      adaptive: trialMetrics(trial.adaptive),
    })),
    pairedDifferences: pairedMetrics(baseline, adaptive),
  };
}

function serializeAblation(arm) {
  const trials = runAblationTrials(arm);
  const compare = (referenceId, comparisonId) => ({
    reference: referenceId,
    comparison: comparisonId,
    convention: `${comparisonId} minus ${referenceId}`,
    pairedDifferences: pairedMetrics(
      trials.map((trial) => trial.variants[referenceId]),
      trials.map((trial) => trial.variants[comparisonId]),
    ),
  });

  return {
    scenario: arm,
    trials: trials.map((trial) => ({
      trial: trial.trial,
      seed: trial.seed,
      variants: Object.fromEntries(
        Object.entries(trial.variants).map(([id, result]) => [
          id,
          trialMetrics(result),
        ]),
      ),
    })),
    contrasts: {
      candidateSelectionWithSnake: compare("baseline-snake", "tail-snake"),
      candidateSelectionWithOptimized: compare(
        "baseline-optimized",
        "tail-optimized",
      ),
      teamBalancingWithBaseline: compare(
        "baseline-snake",
        "baseline-optimized",
      ),
      teamBalancingWithTailAware: compare("tail-snake", "tail-optimized"),
    },
    rawTrials: trials,
  };
}

function flaggedRate(samples, spreadThreshold, teamGapThreshold) {
  const flagged = samples.filter(
    (sample) =>
      sample.spread > spreadThreshold || sample.teamGap > teamGapThreshold,
  ).length;
  return (flagged / samples.length) * 100;
}

function serializeSensitivity(ablation) {
  return {
    scenario: ablation.scenario,
    pairedDifferenceConvention: "Tail-Aware + Optimized minus Baseline + Snake",
    cells: SENSITIVITY_TEAM_GAP_THRESHOLDS.flatMap((teamGapThreshold) =>
      SENSITIVITY_SPREAD_THRESHOLDS.map((spreadThreshold) => {
        const baselineRates = ablation.rawTrials.map((trial) =>
          flaggedRate(
            trial.variants["baseline-snake"].qualitySamples,
            spreadThreshold,
            teamGapThreshold,
          ),
        );
        const adaptiveRates = ablation.rawTrials.map((trial) =>
          flaggedRate(
            trial.variants["tail-optimized"].qualitySamples,
            spreadThreshold,
            teamGapThreshold,
          ),
        );
        return {
          spreadThreshold,
          teamGapThreshold,
          baselineRates,
          adaptiveRates,
          adaptiveMinusBaseline: pairedDifference(baselineRates, adaptiveRates),
        };
      }),
    ),
  };
}

export async function generateBenchmarkValidation() {
  const officialArms = officialBenchmarkArms.map(serializeExperimentArm);
  const lateBalanced = officialBenchmarkArms.find(
    (arm) => arm.id === "late-balanced",
  );
  if (!lateBalanced) {
    throw new Error("The Late-night / Balanced benchmark arm is missing.");
  }

  const ablation = serializeAblation(lateBalanced);
  const sensitivity = serializeSensitivity(ablation);
  delete ablation.rawTrials;

  return {
    schemaVersion: 1,
    description:
      "Synthetic paired-trial validation output; it contains no production matchmaking conclusions.",
    baseSeed: officialBenchmarkArms[0].seed,
    runsPerArm: RUN_COUNT,
    matchesPerRun: MATCHES_PER_RUN,
    officialArms,
    lateNightBalancedAblation: ablation,
    lateNightBalancedSensitivity: sensitivity,
  };
}

export async function main(args = process.argv.slice(2)) {
  const outputPath = parseArguments(args);
  const validation = await generateBenchmarkValidation();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(validation, null, 2)}\n`);
  console.log(`Wrote benchmark validation to ${outputPath}`);
}

const invokedPath = process.argv[1] && resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
