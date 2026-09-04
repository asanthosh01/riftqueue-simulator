import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import {
  MATCHES_PER_RUN,
  RUN_COUNT,
  runExperimentSuite,
} from "../lib/matchmaking.ts";

const BASE_SEED = 20_260_904;
const DEFAULT_OUTPUT_PATH = "outputs/benchmarks/official-benchmarks.json";

const scenarioDefinitions = [
  {
    id: "peak-balanced",
    label: "Peak population / Balanced policy",
    population: 100,
    traffic: "peak",
    policies: ["balanced"],
  },
  {
    id: "late-balanced",
    label: "Late-night population / Balanced policy",
    population: 50,
    traffic: "late",
    policies: ["balanced"],
  },
  {
    id: "overnight-balanced",
    label: "Overnight population / Balanced policy",
    population: 25,
    traffic: "overnight",
    policies: ["balanced"],
  },
  {
    id: "late-policy-tradeoff",
    label: "Late-night population / policy comparison",
    population: 50,
    traffic: "late",
    policies: ["fast", "balanced", "integrity"],
  },
];

export const officialBenchmarkArms = scenarioDefinitions.flatMap((scenario) =>
  scenario.policies.map((policy) => ({
    id:
      scenario.policies.length === 1
        ? scenario.id
        : `${scenario.id}-${policy}`,
    scenarioId: scenario.id,
    label: scenario.label,
    population: scenario.population,
    traffic: scenario.traffic,
    policy,
    seed: BASE_SEED,
    runs: RUN_COUNT,
    matchesPerRun: MATCHES_PER_RUN,
  })),
);

function usage() {
  return [
    "Usage: npm run benchmark:run [-- --output <path>]",
    "       npm run benchmark:dry-run",
  ].join("\n");
}

function parseArguments(args) {
  let dryRun = false;
  let outputPath = DEFAULT_OUTPUT_PATH;

  for (let index = 0; index < args.length; index += 1) {
    const argument = args[index];
    if (argument === "--dry-run") {
      dryRun = true;
      continue;
    }
    if (argument === "--output") {
      const next = args[index + 1];
      if (!next || next.startsWith("--")) {
        throw new Error("--output requires a path.\n" + usage());
      }
      outputPath = next;
      index += 1;
      continue;
    }
    throw new Error(`Unknown argument: ${argument}\n${usage()}`);
  }

  return { dryRun, outputPath: resolve(outputPath) };
}

function reportMetadata() {
  return {
    schemaVersion: 1,
    description:
      "Synthetic RiftQueue benchmark output; not evidence about a production matchmaking system.",
    baseSeed: BASE_SEED,
    runsPerArm: RUN_COUNT,
    matchesPerRun: MATCHES_PER_RUN,
    arms: officialBenchmarkArms,
  };
}

export async function runOfficialBenchmarks() {
  const results = officialBenchmarkArms.map((arm) => ({
    ...arm,
    comparison: runExperimentSuite(arm),
  }));

  return {
    ...reportMetadata(),
    results,
  };
}

export async function main(args = process.argv.slice(2)) {
  const { dryRun, outputPath } = parseArguments(args);
  if (dryRun) {
    console.log(JSON.stringify({ ...reportMetadata(), outputPath }, null, 2));
    return;
  }

  const report = await runOfficialBenchmarks();
  await mkdir(dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(report, null, 2)}\n`);
  console.log(`Wrote ${report.results.length} synthetic benchmark arms to ${outputPath}`);
}

const invokedPath = process.argv[1] && resolve(process.argv[1]);
if (invokedPath === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
