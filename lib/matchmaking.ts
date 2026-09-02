export type Policy = "fast" | "balanced" | "integrity";
export type Traffic = "peak" | "late" | "overnight";
export type Algorithm = "baseline" | "tail-aware";
export type CandidateSelector = Algorithm;
export type TeamBalancer = "snake" | "optimized";
export type AblationVariantId =
  | "baseline-snake"
  | "baseline-optimized"
  | "tail-snake"
  | "tail-optimized";

type QueuePlayer = {
  id: number;
  name: string;
  role: string;
  mmr: number;
  arrivalTime: number;
};

export type DisplayPlayer = {
  name: string;
  role: string;
  rank: string;
  rr: number;
  mmr: number;
  wait: number;
  team: "A" | "B";
};

type CompletedMatch = {
  players: DisplayPlayer[];
  spread: number;
  teamGap: number;
  waits: number[];
};

type QualitySample = Pick<CompletedMatch, "spread" | "teamGap">;

export type MatchmakingResult = {
  algorithm: Algorithm;
  queueSeconds: number;
  p95QueueSeconds: number;
  spread: number;
  teamGap: number;
  badMatchRate: number;
  playersGenerated: number;
  matchesSimulated: number;
  players: DisplayPlayer[];
};

type MatcherRunResult = MatchmakingResult & {
  qualitySamples: QualitySample[];
};

export type ComparisonResult = {
  baseline: MatchmakingResult;
  adaptive: MatchmakingResult;
};

export type ConfidenceInterval = {
  low: number;
  high: number;
};

export type ExperimentResult = MatchmakingResult & {
  runs: number;
  confidence: {
    queueSeconds: ConfidenceInterval;
    p95QueueSeconds: ConfidenceInterval;
    spread: ConfidenceInterval;
    teamGap: ConfidenceInterval;
    badMatchRate: ConfidenceInterval;
  };
};

export type ExperimentComparison = {
  baseline: ExperimentResult;
  adaptive: ExperimentResult;
};

export type AblationVariantResult = ExperimentResult & {
  id: AblationVariantId;
  selector: CandidateSelector;
  balancer: TeamBalancer;
  label: string;
};

export type AblationStudyResult = {
  variants: Record<AblationVariantId, AblationVariantResult>;
  scenario: {
    population: number;
    traffic: Traffic;
    policy: Policy;
    seed: number;
  };
  effects: {
    candidateSelectionWithSnake: number;
    candidateSelectionWithOptimized: number;
    teamBalancingWithBaseline: number;
    teamBalancingWithTail: number;
    fullSystem: number;
  };
  runs: number;
  matchesPerRun: number;
};

export type SensitivityCell = {
  spreadThreshold: number;
  teamGapThreshold: number;
  baselineRate: number;
  adaptiveRate: number;
  reduction: number;
  candidateSelectionEffect: number;
  teamBalancingEffect: number;
};

export type SensitivityStudyResult = {
  cells: SensitivityCell[];
  currentDefinition: SensitivityCell;
  wins: number;
  balancingMatters: number;
  minReduction: number;
  maxReduction: number;
  scenario: {
    population: number;
    traffic: Traffic;
    policy: Policy;
    seed: number;
  };
  runs: number;
  matchesPerRun: number;
};

export type ParetoPoint = {
  id: string;
  label: string;
  radiusScale: number | null;
  queueSeconds: number;
  p95QueueSeconds: number;
  badMatchRate: number;
  spread: number;
  efficient: boolean;
  baseline: boolean;
};

export type ParetoStudyResult = {
  points: ParetoPoint[];
  frontier: ParetoPoint[];
  recommended: ParetoPoint;
  scenario: {
    population: number;
    traffic: Traffic;
    policy: Policy;
    seed: number;
  };
  runs: number;
  matchesPerRun: number;
};

export type OracleSnapshotResult = {
  snapshot: number;
  waitSeconds: number;
  baselineCost: number;
  tailCost: number;
  oracleCost: number;
  baselineSpread: number;
  tailSpread: number;
  oracleSpread: number;
  baselineRuntimeMs: number;
  tailRuntimeMs: number;
  oracleRuntimeMs: number;
};

export type OracleBenchmarkResult = {
  snapshots: OracleSnapshotResult[];
  baselineQualityAchieved: number;
  tailQualityAchieved: number;
  tailBeatsBaseline: number;
  tailExactHits: number;
  averageRuntimeMs: {
    baseline: number;
    tail: number;
    oracle: number;
  };
  oracleSlowdown: number;
  candidateLobbiesPerSnapshot: number;
  teamLayoutsPerSnapshot: number;
  poolSize: number;
  scenario: {
    population: number;
    traffic: Traffic;
    policy: Policy;
    seed: number;
  };
};

export type ScaleBenchmarkRow = {
  queueSize: number;
  baselineRuntimeMs: number;
  tailRuntimeMs: number;
  baselineThroughput: number;
  tailThroughput: number;
  runtimeRatio: number;
  baselineSpread: number;
  tailSpread: number;
  baselineCost: number;
  tailCost: number;
};

export type ScaleBenchmarkResult = {
  rows: ScaleBenchmarkRow[];
  maxWithinBudget: number;
  latencyBudgetMs: number;
  tailGrowthExponent: number;
  qualityWins: number;
  iterations: number;
  scenario: {
    population: number;
    traffic: Traffic;
    policy: Policy;
    seed: number;
  };
};

export const RUN_COUNT = 8;
export const MATCHES_PER_RUN = 500;
export const MATCH_TARGET = RUN_COUNT * MATCHES_PER_RUN;
export const SWEEP_RUNS = 3;
export const SWEEP_MATCHES_PER_RUN = 150;
export const ABLATION_RUNS = 6;
export const ABLATION_MATCHES_PER_RUN = 300;
export const SENSITIVITY_RUNS = 5;
export const SENSITIVITY_MATCHES_PER_RUN = 250;
export const PARETO_RUNS = 5;
export const PARETO_MATCHES_PER_RUN = 250;
export const ORACLE_SNAPSHOTS = 20;
export const ORACLE_POOL_SIZE = 14;
export const SCALE_ITERATIONS = 7;
export const SCALE_LATENCY_BUDGET_MS = 50;
export const SCALE_QUEUE_SIZES = [
  50,
  100,
  250,
  500,
  1_000,
  2_000,
  5_000,
  10_000,
  20_000,
  50_000,
] as const;
export const BAD_SPREAD_THRESHOLD = 280;
export const BAD_TEAM_GAP_THRESHOLD = 42;
export const SENSITIVITY_SPREAD_THRESHOLDS = [220, 250, 280, 320] as const;
export const SENSITIVITY_TEAM_GAP_THRESHOLDS = [5, 10, 20, 42] as const;
export const COLLAPSE_BAD_MATCH_RATE = 50;
export const SWEEP_POPULATIONS = [25, 50, 75, 100] as const;
export const SWEEP_TRAFFIC = ["peak", "late", "overnight"] as const;
export const SWEEP_POLICIES = ["fast", "balanced", "integrity"] as const;

export type SweepMetric = {
  queueSeconds: number;
  spread: number;
  badMatchRate: number;
  collapsed: boolean;
};

export type ScenarioSweepRow = {
  population: number;
  traffic: Traffic;
  policy: Policy;
  baseline: SweepMetric;
  adaptive: SweepMetric;
  badMatchReduction: number;
  extraWait: number;
};

export type ScenarioSweepResult = {
  rows: ScenarioSweepRow[];
  baselineCollapses: number;
  adaptiveCollapses: number;
  qualityWins: number;
  biggestReduction: ScenarioSweepRow;
  runsPerScenario: number;
  matchesPerRun: number;
};

const roles = [
  "DUELIST",
  "CONTROLLER",
  "INITIATOR",
  "SENTINEL",
  "FLEX",
] as const;

const handleParts = [
  "mako",
  "sonder",
  "orbit",
  "vanta",
  "pixel",
  "north",
  "lotus",
  "rook",
  "kinetic",
  "zerofox",
  "echo",
  "nova",
  "drift",
  "rune",
  "tempo",
  "ghost",
] as const;

function mulberry32(seed: number) {
  return () => {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function rankFor(mmr: number) {
  if (mmr >= 2425) return "RADIANT";
  if (mmr >= 2300) return "IMMORTAL 3";
  if (mmr >= 2200) return "IMMORTAL 2";
  if (mmr >= 2100) return "IMMORTAL 1";
  return "ASCENDANT 3";
}

function rankRR(mmr: number) {
  if (mmr >= 2425) {
    return Math.max(1, Math.round(500 - ((mmr - 2425) / 275) * 499));
  }
  return Math.max(1, mmr % 100);
}

function percentile(values: number[], fraction: number) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const index = Math.min(
    sorted.length - 1,
    Math.max(0, Math.floor((sorted.length - 1) * fraction)),
  );
  return sorted[index];
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function confidenceInterval(values: number[]): ConfidenceInterval {
  const mean = average(values);
  if (values.length < 2) return { low: mean, high: mean };
  const sampleVariance =
    values.reduce((sum, value) => sum + Math.pow(value - mean, 2), 0) /
    (values.length - 1);
  const margin = 1.96 * (Math.sqrt(sampleVariance) / Math.sqrt(values.length));
  return {
    low: Math.max(0, mean - margin),
    high: mean + margin,
  };
}

function generatedHandle(id: number) {
  const first = handleParts[id % handleParts.length];
  const second = handleParts[(id * 7 + 3) % handleParts.length];
  return id < handleParts.length
    ? first
    : `${first}${second.slice(0, 2)}${id % 97}`;
}

function generateMmr(random: () => number) {
  const tier = random();
  if (tier < 0.34) return 1950 + Math.floor(random() * 150);
  if (tier < 0.62) return 2100 + Math.floor(random() * 100);
  if (tier < 0.82) return 2200 + Math.floor(random() * 100);
  if (tier < 0.95) return 2300 + Math.floor(random() * 125);
  return 2425 + Math.floor(Math.pow(random(), 1.8) * 275);
}

function generateArrivals(
  population: number,
  traffic: Traffic,
  seed: number,
  targetMatches: number,
) {
  const random = mulberry32(seed);
  const trafficFactor = { peak: 1, late: 0.56, overnight: 0.24 }[traffic];
  const density = Math.max(0.06, (population / 100) * trafficFactor);
  const playersPerSecond = 0.32 * density;
  const totalPlayers = targetMatches * 12;
  const players: QueuePlayer[] = [];
  let arrivalTime = 0;

  for (let id = 0; id < totalPlayers; id += 1) {
    const interval = -Math.log(Math.max(0.000001, 1 - random())) / playersPerSecond;
    arrivalTime += interval;
    players.push({
      id,
      name: generatedHandle(id),
      role: roles[Math.floor(random() * roles.length)],
      mmr: generateMmr(random),
      arrivalTime,
    });
  }

  return players;
}

function policyShape(policy: Policy) {
  if (policy === "fast") {
    return { interval: 20, baselineBase: 105, baselineStep: 62, tailBase: 82, tailStep: 44 };
  }
  if (policy === "integrity") {
    return { interval: 90, baselineBase: 62, baselineStep: 38, tailBase: 46, tailStep: 24 };
  }
  return { interval: 45, baselineBase: 80, baselineStep: 48, tailBase: 62, tailStep: 32 };
}

function searchRadius(
  player: QueuePlayer,
  now: number,
  policy: Policy,
  algorithm: Algorithm,
  tailRadiusScale = 1,
) {
  const config = policyShape(policy);
  const wait = Math.max(0, now - player.arrivalTime);

  if (algorithm === "baseline") {
    return Math.min(
      750,
      config.baselineBase +
        Math.floor(wait / config.interval) * config.baselineStep,
    );
  }

  const topTail = player.mmr >= 2425;
  const initial = config.tailBase * (topTail ? 0.72 : 1);
  const step = config.tailStep * (topTail ? 0.68 : 1);
  const emergencyExpansion = wait > 300 ? (wait - 300) * 0.55 : 0;
  return Math.min(
    750,
    (initial + Math.floor(wait / config.interval) * step + emergencyExpansion) *
      tailRadiusScale,
  );
}

function snakeTeams(players: QueuePlayer[]) {
  const ordered = [...players].sort((a, b) => b.mmr - a.mmr);
  const teamAPositions = new Set([0, 3, 4, 7, 8]);
  return ordered.map((player, index) => ({
    player,
    team: (teamAPositions.has(index) ? "A" : "B") as "A" | "B",
  }));
}

function optimizedTeams(players: QueuePlayer[]) {
  const ordered = [...players].sort((a, b) => b.mmr - a.mmr);
  const total = ordered.reduce((sum, player) => sum + player.mmr, 0);
  let bestMask = 0;
  let bestDifference = Number.POSITIVE_INFINITY;

  for (let mask = 1; mask < 1 << ordered.length; mask += 1) {
    if ((mask & 1) === 0) continue;
    let count = 0;
    let teamATotal = 0;
    for (let index = 0; index < ordered.length; index += 1) {
      if ((mask & (1 << index)) !== 0) {
        count += 1;
        teamATotal += ordered[index].mmr;
      }
    }
    if (count !== 5) continue;
    const difference = Math.abs(teamATotal - (total - teamATotal));
    if (difference < bestDifference) {
      bestDifference = difference;
      bestMask = mask;
    }
  }

  return ordered.map((player, index) => ({
    player,
    team: ((bestMask & (1 << index)) !== 0 ? "A" : "B") as "A" | "B",
  }));
}

function teamGap(
  assignments: Array<{ player: QueuePlayer; team: "A" | "B" }>,
) {
  const teamA = assignments
    .filter(({ team }) => team === "A")
    .map(({ player }) => player.mmr);
  const teamB = assignments
    .filter(({ team }) => team === "B")
    .map(({ player }) => player.mmr);
  return Math.abs(average(teamA) - average(teamB));
}

function matchObjective(
  players: QueuePlayer[],
  assignments: Array<{ player: QueuePlayer; team: "A" | "B" }>,
  now: number,
) {
  const mmrs = players.map((player) => player.mmr);
  const lowestMmr = Math.min(...mmrs);
  const highestMmr = Math.max(...mmrs);
  const spread = highestMmr - lowestMmr;
  const gap = teamGap(assignments);
  const includesRadiant = highestMmr >= 2425;
  const tailPenalty =
    includesRadiant && lowestMmr < 2250 ? (2250 - lowestMmr) * 2.5 : 0;
  const averageWait = average(
    players.map((player) => Math.max(0, now - player.arrivalTime)),
  );

  return {
    cost: spread + gap * 3 + tailPenalty - averageWait * 0.035,
    spread,
    teamGap: gap,
  };
}

function baselineCandidates(
  queue: QueuePlayer[],
  now: number,
  policy: Policy,
) {
  const anchors = [...queue]
    .sort((a, b) => a.arrivalTime - b.arrivalTime)
    .slice(0, 14);

  for (const anchor of anchors) {
    const radius = searchRadius(anchor, now, policy, "baseline");
    const eligible = queue
      .filter((player) => Math.abs(player.mmr - anchor.mmr) <= radius)
      .sort((a, b) => {
        const skillDifference =
          Math.abs(a.mmr - anchor.mmr) - Math.abs(b.mmr - anchor.mmr);
        return skillDifference || a.arrivalTime - b.arrivalTime;
      });
    if (eligible.length >= 10) return eligible.slice(0, 10);
  }

  return null;
}

function tailAwareCandidates(
  queue: QueuePlayer[],
  now: number,
  policy: Policy,
  radiusScale = 1,
) {
  const anchors = [...queue]
    .sort((a, b) => a.arrivalTime - b.arrivalTime)
    .slice(0, 18);
  let best:
    | {
        players: QueuePlayer[];
        score: number;
        oldestArrival: number;
      }
    | null = null;

  for (const anchor of anchors) {
    const radius = searchRadius(
      anchor,
      now,
      policy,
      "tail-aware",
      radiusScale,
    );
    const eligible = queue
      .filter((player) => Math.abs(player.mmr - anchor.mmr) <= radius)
      .sort((a, b) => a.mmr - b.mmr);

    if (eligible.length < 10) continue;
    const anchorIndex = eligible.findIndex((player) => player.id === anchor.id);
    const firstWindow = Math.max(0, anchorIndex - 9);
    const lastWindow = Math.min(anchorIndex, eligible.length - 10);

    for (let start = firstWindow; start <= lastWindow; start += 1) {
      const players = eligible.slice(start, start + 10);
      const assignments = optimizedTeams(players);
      const score = matchObjective(players, assignments, now).cost;
      const oldestArrival = Math.min(
        ...players.map((player) => player.arrivalTime),
      );

      if (
        !best ||
        score < best.score ||
        (score === best.score && oldestArrival < best.oldestArrival)
      ) {
        best = { players, score, oldestArrival };
      }
    }
  }

  return best?.players ?? null;
}

function completeMatch(
  players: QueuePlayer[],
  now: number,
  balancer: TeamBalancer,
): CompletedMatch {
  const assignments =
    balancer === "optimized" ? optimizedTeams(players) : snakeTeams(players);
  const waits = players.map((player) => Math.max(0, now - player.arrivalTime));
  const mmrs = players.map((player) => player.mmr);
  const displayPlayers = assignments
    .map(({ player, team }) => ({
      name: player.name,
      role: player.role,
      rank: rankFor(player.mmr),
      rr: rankRR(player.mmr),
      mmr: player.mmr,
      wait: Math.max(0, now - player.arrivalTime),
      team,
    }))
    .sort((a, b) => b.mmr - a.mmr);

  return {
    players: displayPlayers,
    spread: Math.max(...mmrs) - Math.min(...mmrs),
    teamGap: teamGap(assignments),
    waits,
  };
}

function runMatcher(
  arrivals: QueuePlayer[],
  policy: Policy,
  selector: CandidateSelector,
  balancer: TeamBalancer,
  targetMatches: number,
  tailRadiusScale = 1,
): MatcherRunResult {
  const queue: QueuePlayer[] = [];
  const matches: CompletedMatch[] = [];
  let arrivalIndex = 0;
  let now = arrivals[0]?.arrivalTime ?? 0;
  let safetyTicks = 0;

  while (matches.length < targetMatches && safetyTicks < 2_000_000) {
    safetyTicks += 1;
    while (
      arrivalIndex < arrivals.length &&
      arrivals[arrivalIndex].arrivalTime <= now
    ) {
      queue.push(arrivals[arrivalIndex]);
      arrivalIndex += 1;
    }

    let formedMatch = false;
    while (queue.length >= 10 && matches.length < targetMatches) {
      const players =
        selector === "tail-aware"
          ? tailAwareCandidates(queue, now, policy, tailRadiusScale)
          : baselineCandidates(queue, now, policy);
      if (!players) break;

      matches.push(completeMatch(players, now, balancer));
      const selected = new Set(players.map((player) => player.id));
      for (let index = queue.length - 1; index >= 0; index -= 1) {
        if (selected.has(queue[index].id)) queue.splice(index, 1);
      }
      formedMatch = true;
    }

    if (!formedMatch) now += 5;
  }

  if (matches.length === 0) {
    throw new Error("The queue could not form a match with these settings.");
  }

  const allWaits = matches.flatMap((match) => match.waits);
  const spreads = matches.map((match) => match.spread);
  const gaps = matches.map((match) => match.teamGap);
  const badMatches = matches.filter(
    (match) =>
      match.spread > BAD_SPREAD_THRESHOLD ||
      match.teamGap > BAD_TEAM_GAP_THRESHOLD,
  ).length;
  const representative = [...matches].sort(
    (a, b) => a.spread - b.spread,
  )[Math.floor(matches.length / 2)];

  return {
    algorithm: selector,
    queueSeconds: percentile(allWaits, 0.5),
    p95QueueSeconds: percentile(allWaits, 0.95),
    spread: average(spreads),
    teamGap: average(gaps),
    badMatchRate: (badMatches / matches.length) * 100,
    playersGenerated: arrivalIndex,
    matchesSimulated: matches.length,
    players: representative.players,
    qualitySamples: matches.map(({ spread, teamGap }) => ({
      spread,
      teamGap,
    })),
  };
}

export function runComparison({
  population,
  traffic,
  policy,
  seed,
  targetMatches = MATCHES_PER_RUN,
}: {
  population: number;
  traffic: Traffic;
  policy: Policy;
  seed: number;
  targetMatches?: number;
}): ComparisonResult {
  const arrivals = generateArrivals(
    population,
    traffic,
    seed,
    targetMatches,
  );
  return {
    baseline: runMatcher(
      arrivals,
      policy,
      "baseline",
      "snake",
      targetMatches,
    ),
    adaptive: runMatcher(
      arrivals,
      policy,
      "tail-aware",
      "optimized",
      targetMatches,
    ),
  };
}

function aggregateResults(
  results: MatchmakingResult[],
  algorithm: Algorithm,
): ExperimentResult {
  const queueValues = results.map((result) => result.queueSeconds);
  const p95Values = results.map((result) => result.p95QueueSeconds);
  const spreadValues = results.map((result) => result.spread);
  const gapValues = results.map((result) => result.teamGap);
  const badMatchValues = results.map((result) => result.badMatchRate);
  const meanSpread = average(spreadValues);
  const representative = results.reduce((closest, result) =>
    Math.abs(result.spread - meanSpread) <
    Math.abs(closest.spread - meanSpread)
      ? result
      : closest,
  );

  return {
    algorithm,
    queueSeconds: average(queueValues),
    p95QueueSeconds: average(p95Values),
    spread: meanSpread,
    teamGap: average(gapValues),
    badMatchRate: average(badMatchValues),
    playersGenerated: results.reduce(
      (sum, result) => sum + result.playersGenerated,
      0,
    ),
    matchesSimulated: results.reduce(
      (sum, result) => sum + result.matchesSimulated,
      0,
    ),
    players: representative.players,
    runs: results.length,
    confidence: {
      queueSeconds: confidenceInterval(queueValues),
      p95QueueSeconds: confidenceInterval(p95Values),
      spread: confidenceInterval(spreadValues),
      teamGap: confidenceInterval(gapValues),
      badMatchRate: confidenceInterval(badMatchValues),
    },
  };
}

export function aggregateExperimentComparisons(
  comparisons: ComparisonResult[],
): ExperimentComparison {
  if (comparisons.length === 0) {
    throw new Error("At least one completed comparison is required.");
  }

  return {
    baseline: aggregateResults(
      comparisons.map((comparison) => comparison.baseline),
      "baseline",
    ),
    adaptive: aggregateResults(
      comparisons.map((comparison) => comparison.adaptive),
      "tail-aware",
    ),
  };
}

export function runExperimentSuite({
  population,
  traffic,
  policy,
  seed,
  runs = RUN_COUNT,
  matchesPerRun = MATCHES_PER_RUN,
}: {
  population: number;
  traffic: Traffic;
  policy: Policy;
  seed: number;
  runs?: number;
  matchesPerRun?: number;
}): ExperimentComparison {
  const comparisons: ComparisonResult[] = [];

  for (let run = 0; run < runs; run += 1) {
    comparisons.push(runComparison({
      population,
      traffic,
      policy,
      seed: seed + run * 7_919,
      targetMatches: matchesPerRun,
    }));
  }

  return aggregateExperimentComparisons(comparisons);
}

const ablationVariants: Array<{
  id: AblationVariantId;
  selector: CandidateSelector;
  balancer: TeamBalancer;
  label: string;
}> = [
  {
    id: "baseline-snake",
    selector: "baseline",
    balancer: "snake",
    label: "Baseline + Snake",
  },
  {
    id: "baseline-optimized",
    selector: "baseline",
    balancer: "optimized",
    label: "Baseline + Optimized",
  },
  {
    id: "tail-snake",
    selector: "tail-aware",
    balancer: "snake",
    label: "Tail-Aware + Snake",
  },
  {
    id: "tail-optimized",
    selector: "tail-aware",
    balancer: "optimized",
    label: "Tail-Aware + Optimized",
  },
];

export function runAblationStudy({
  population,
  traffic,
  policy,
  seed,
  runs = ABLATION_RUNS,
  matchesPerRun = ABLATION_MATCHES_PER_RUN,
}: {
  population: number;
  traffic: Traffic;
  policy: Policy;
  seed: number;
  runs?: number;
  matchesPerRun?: number;
}): AblationStudyResult {
  const results = Object.fromEntries(
    ablationVariants.map((variant) => [variant.id, [] as MatchmakingResult[]]),
  ) as Record<AblationVariantId, MatchmakingResult[]>;

  for (let run = 0; run < runs; run += 1) {
    const arrivals = generateArrivals(
      population,
      traffic,
      seed + run * 7_919,
      matchesPerRun,
    );

    for (const variant of ablationVariants) {
      results[variant.id].push(
        runMatcher(
          arrivals,
          policy,
          variant.selector,
          variant.balancer,
          matchesPerRun,
        ),
      );
    }
  }

  const variants = Object.fromEntries(
    ablationVariants.map((variant) => [
      variant.id,
      {
        ...aggregateResults(results[variant.id], variant.selector),
        ...variant,
      },
    ]),
  ) as Record<AblationVariantId, AblationVariantResult>;

  const baselineSnake = variants["baseline-snake"].badMatchRate;
  const baselineOptimized = variants["baseline-optimized"].badMatchRate;
  const tailSnake = variants["tail-snake"].badMatchRate;
  const tailOptimized = variants["tail-optimized"].badMatchRate;

  return {
    variants,
    scenario: { population, traffic, policy, seed },
    effects: {
      candidateSelectionWithSnake: baselineSnake - tailSnake,
      candidateSelectionWithOptimized: baselineOptimized - tailOptimized,
      teamBalancingWithBaseline: baselineSnake - baselineOptimized,
      teamBalancingWithTail: tailSnake - tailOptimized,
      fullSystem: baselineSnake - tailOptimized,
    },
    runs,
    matchesPerRun,
  };
}

function flaggedRate(
  samples: QualitySample[],
  spreadThreshold: number,
  teamGapThreshold: number,
) {
  const flagged = samples.filter(
    (sample) =>
      sample.spread > spreadThreshold || sample.teamGap > teamGapThreshold,
  ).length;
  return (flagged / samples.length) * 100;
}

export function runSensitivityStudy({
  population,
  traffic,
  policy,
  seed,
  runs = SENSITIVITY_RUNS,
  matchesPerRun = SENSITIVITY_MATCHES_PER_RUN,
}: {
  population: number;
  traffic: Traffic;
  policy: Policy;
  seed: number;
  runs?: number;
  matchesPerRun?: number;
}): SensitivityStudyResult {
  const samples = Object.fromEntries(
    ablationVariants.map((variant) => [variant.id, [] as QualitySample[]]),
  ) as Record<AblationVariantId, QualitySample[]>;

  for (let run = 0; run < runs; run += 1) {
    const arrivals = generateArrivals(
      population,
      traffic,
      seed + run * 7_919,
      matchesPerRun,
    );

    for (const variant of ablationVariants) {
      const result = runMatcher(
        arrivals,
        policy,
        variant.selector,
        variant.balancer,
        matchesPerRun,
      );
      samples[variant.id].push(...result.qualitySamples);
    }
  }

  const cells = SENSITIVITY_TEAM_GAP_THRESHOLDS.flatMap((teamGapThreshold) =>
    SENSITIVITY_SPREAD_THRESHOLDS.map((spreadThreshold) => {
      const baselineRate = flaggedRate(
        samples["baseline-snake"],
        spreadThreshold,
        teamGapThreshold,
      );
      const baselineOptimizedRate = flaggedRate(
        samples["baseline-optimized"],
        spreadThreshold,
        teamGapThreshold,
      );
      const tailSnakeRate = flaggedRate(
        samples["tail-snake"],
        spreadThreshold,
        teamGapThreshold,
      );
      const adaptiveRate = flaggedRate(
        samples["tail-optimized"],
        spreadThreshold,
        teamGapThreshold,
      );

      return {
        spreadThreshold,
        teamGapThreshold,
        baselineRate,
        adaptiveRate,
        reduction: baselineRate - adaptiveRate,
        candidateSelectionEffect: baselineRate - tailSnakeRate,
        teamBalancingEffect: baselineRate - baselineOptimizedRate,
      };
    }),
  );
  const currentDefinition = cells.find(
    (cell) =>
      cell.spreadThreshold === BAD_SPREAD_THRESHOLD &&
      cell.teamGapThreshold === BAD_TEAM_GAP_THRESHOLD,
  );

  if (!currentDefinition) {
    throw new Error("The current bad-match definition is missing from the study.");
  }

  return {
    cells,
    currentDefinition,
    wins: cells.filter((cell) => cell.reduction > 0).length,
    balancingMatters: cells.filter((cell) => cell.teamBalancingEffect > 0.5)
      .length,
    minReduction: Math.min(...cells.map((cell) => cell.reduction)),
    maxReduction: Math.max(...cells.map((cell) => cell.reduction)),
    scenario: { population, traffic, policy, seed },
    runs,
    matchesPerRun,
  };
}

const paretoConfigs = [
  { id: "max-integrity", label: "Max Integrity", radiusScale: 0.55 },
  { id: "integrity", label: "Integrity", radiusScale: 0.7 },
  { id: "quality", label: "Quality", radiusScale: 0.85 },
  { id: "default", label: "Default", radiusScale: 1 },
  { id: "responsive", label: "Responsive", radiusScale: 1.2 },
  { id: "fast", label: "Fast", radiusScale: 1.45 },
  { id: "fastest", label: "Fastest", radiusScale: 1.75 },
] as const;

export function runParetoStudy({
  population,
  traffic,
  policy,
  seed,
  runs = PARETO_RUNS,
  matchesPerRun = PARETO_MATCHES_PER_RUN,
}: {
  population: number;
  traffic: Traffic;
  policy: Policy;
  seed: number;
  runs?: number;
  matchesPerRun?: number;
}): ParetoStudyResult {
  const baselineRuns: MatchmakingResult[] = [];
  const configRuns = Object.fromEntries(
    paretoConfigs.map((config) => [config.id, [] as MatchmakingResult[]]),
  ) as Record<(typeof paretoConfigs)[number]["id"], MatchmakingResult[]>;

  for (let run = 0; run < runs; run += 1) {
    const arrivals = generateArrivals(
      population,
      traffic,
      seed + run * 7_919,
      matchesPerRun,
    );
    baselineRuns.push(
      runMatcher(arrivals, policy, "baseline", "snake", matchesPerRun),
    );

    for (const config of paretoConfigs) {
      configRuns[config.id].push(
        runMatcher(
          arrivals,
          policy,
          "tail-aware",
          "optimized",
          matchesPerRun,
          config.radiusScale,
        ),
      );
    }
  }

  const baseline = aggregateResults(baselineRuns, "baseline");
  const rawPoints: Array<Omit<ParetoPoint, "efficient">> = [
    {
      id: "baseline",
      label: "Baseline",
      radiusScale: null,
      queueSeconds: baseline.queueSeconds,
      p95QueueSeconds: baseline.p95QueueSeconds,
      badMatchRate: baseline.badMatchRate,
      spread: baseline.spread,
      baseline: true,
    },
    ...paretoConfigs.map((config) => {
      const result = aggregateResults(configRuns[config.id], "tail-aware");
      return {
        id: config.id,
        label: config.label,
        radiusScale: config.radiusScale,
        queueSeconds: result.queueSeconds,
        p95QueueSeconds: result.p95QueueSeconds,
        badMatchRate: result.badMatchRate,
        spread: result.spread,
        baseline: false,
      };
    }),
  ];

  const points = rawPoints.map((point) => ({
    ...point,
    efficient: !rawPoints.some(
      (other) =>
        other.id !== point.id &&
        other.queueSeconds <= point.queueSeconds &&
        other.badMatchRate <= point.badMatchRate &&
        (other.queueSeconds < point.queueSeconds ||
          other.badMatchRate < point.badMatchRate),
    ),
  }));
  const frontier = points
    .filter((point) => point.efficient)
    .sort((a, b) => a.queueSeconds - b.queueSeconds);
  const minQueue = Math.min(...frontier.map((point) => point.queueSeconds));
  const maxQueue = Math.max(...frontier.map((point) => point.queueSeconds));
  const minBadRate = Math.min(...frontier.map((point) => point.badMatchRate));
  const maxBadRate = Math.max(...frontier.map((point) => point.badMatchRate));
  const queueRange = Math.max(0.001, maxQueue - minQueue);
  const badRateRange = Math.max(0.001, maxBadRate - minBadRate);
  const recommended = frontier.reduce((best, point) => {
    const score = Math.hypot(
      (point.queueSeconds - minQueue) / queueRange,
      (point.badMatchRate - minBadRate) / badRateRange,
    );
    const bestScore = Math.hypot(
      (best.queueSeconds - minQueue) / queueRange,
      (best.badMatchRate - minBadRate) / badRateRange,
    );
    return score < bestScore ? point : best;
  });

  return {
    points: points.sort((a, b) => a.queueSeconds - b.queueSeconds),
    frontier,
    recommended,
    scenario: { population, traffic, policy, seed },
    runs,
    matchesPerRun,
  };
}

function combinationCount(total: number, choose: number) {
  let result = 1;
  for (let index = 1; index <= choose; index += 1) {
    result = (result * (total - choose + index)) / index;
  }
  return Math.round(result);
}

function visitCombinations<T>(
  values: T[],
  choose: number,
  visit: (selection: T[]) => void,
) {
  const selected: T[] = [];
  function walk(start: number) {
    if (selected.length === choose) {
      visit([...selected]);
      return;
    }
    const remaining = choose - selected.length;
    for (let index = start; index <= values.length - remaining; index += 1) {
      selected.push(values[index]);
      walk(index + 1);
      selected.pop();
    }
  }
  walk(0);
}

function exactOracle(players: QueuePlayer[], now: number) {
  let best:
    | {
        cost: number;
        spread: number;
        teamGap: number;
      }
    | null = null;

  visitCombinations(players, 10, (candidatePlayers) => {
    const assignments = optimizedTeams(candidatePlayers);
    const evaluated = matchObjective(candidatePlayers, assignments, now);
    if (!best || evaluated.cost < best.cost) best = evaluated;
  });

  if (!best) throw new Error("The oracle could not form a ten-player lobby.");
  return best;
}

function benchmarkClock() {
  return globalThis.performance?.now() ?? Date.now();
}

export function runOracleBenchmark({
  population,
  traffic,
  policy,
  seed,
  snapshots = ORACLE_SNAPSHOTS,
  poolSize = ORACLE_POOL_SIZE,
}: {
  population: number;
  traffic: Traffic;
  policy: Policy;
  seed: number;
  snapshots?: number;
  poolSize?: number;
}): OracleBenchmarkResult {
  if (poolSize < 10 || poolSize > 18) {
    throw new Error("Oracle pool size must be between 10 and 18 players.");
  }
  const targetMatches = Math.ceil((snapshots * poolSize) / 12) + 1;
  const arrivals = generateArrivals(
    population,
    traffic,
    seed,
    targetMatches,
  );
  const results: OracleSnapshotResult[] = [];

  for (let snapshot = 0; snapshot < snapshots; snapshot += 1) {
    const pool = arrivals.slice(snapshot * poolSize, (snapshot + 1) * poolSize);
    if (pool.length < poolSize) break;
    const latestArrival = Math.max(...pool.map((player) => player.arrivalTime));
    let now = latestArrival + 45;
    let baselinePlayers = baselineCandidates(pool, now, policy);
    let tailPlayers = tailAwareCandidates(pool, now, policy);

    while ((!baselinePlayers || !tailPlayers) && now < latestArrival + 1_200) {
      now += 5;
      baselinePlayers = baselineCandidates(pool, now, policy);
      tailPlayers = tailAwareCandidates(pool, now, policy);
    }
    if (!baselinePlayers || !tailPlayers) {
      throw new Error("A benchmark snapshot could not form a match.");
    }

    const baselineStart = benchmarkClock();
    baselinePlayers = baselineCandidates(pool, now, policy);
    const baselineAssignments = snakeTeams(baselinePlayers!);
    const baselineEvaluation = matchObjective(
      baselinePlayers!,
      baselineAssignments,
      now,
    );
    const baselineRuntimeMs = benchmarkClock() - baselineStart;

    const tailStart = benchmarkClock();
    tailPlayers = tailAwareCandidates(pool, now, policy);
    const tailAssignments = optimizedTeams(tailPlayers!);
    const tailEvaluation = matchObjective(tailPlayers!, tailAssignments, now);
    const tailRuntimeMs = benchmarkClock() - tailStart;

    const oracleStart = benchmarkClock();
    const oracleEvaluation = exactOracle(pool, now);
    const oracleRuntimeMs = benchmarkClock() - oracleStart;

    results.push({
      snapshot: snapshot + 1,
      waitSeconds: average(pool.map((player) => now - player.arrivalTime)),
      baselineCost: baselineEvaluation.cost,
      tailCost: tailEvaluation.cost,
      oracleCost: oracleEvaluation.cost,
      baselineSpread: baselineEvaluation.spread,
      tailSpread: tailEvaluation.spread,
      oracleSpread: oracleEvaluation.spread,
      baselineRuntimeMs,
      tailRuntimeMs,
      oracleRuntimeMs,
    });
  }

  const qualityAchieved = (heuristic: "baselineCost" | "tailCost") =>
    average(
      results.map((result) =>
        Math.max(
          0,
          Math.min(
            100,
            (result.oracleCost / Math.max(0.001, result[heuristic])) * 100,
          ),
        ),
      ),
    );
  const averageRuntimeMs = {
    baseline: average(results.map((result) => result.baselineRuntimeMs)),
    tail: average(results.map((result) => result.tailRuntimeMs)),
    oracle: average(results.map((result) => result.oracleRuntimeMs)),
  };
  const candidateLobbiesPerSnapshot = combinationCount(poolSize, 10);
  const teamLayoutsPerLobby = combinationCount(10, 5) / 2;

  return {
    snapshots: results,
    baselineQualityAchieved: qualityAchieved("baselineCost"),
    tailQualityAchieved: qualityAchieved("tailCost"),
    tailBeatsBaseline: results.filter(
      (result) => result.tailCost < result.baselineCost,
    ).length,
    tailExactHits: results.filter(
      (result) => Math.abs(result.tailCost - result.oracleCost) < 0.001,
    ).length,
    averageRuntimeMs,
    oracleSlowdown:
      averageRuntimeMs.oracle / Math.max(0.0001, averageRuntimeMs.tail),
    candidateLobbiesPerSnapshot,
    teamLayoutsPerSnapshot: Math.round(
      candidateLobbiesPerSnapshot * teamLayoutsPerLobby,
    ),
    poolSize,
    scenario: { population, traffic, policy, seed },
  };
}

export function runScaleBenchmark({
  population,
  traffic,
  policy,
  seed,
  iterations = SCALE_ITERATIONS,
}: {
  population: number;
  traffic: Traffic;
  policy: Policy;
  seed: number;
  iterations?: number;
}): ScaleBenchmarkResult {
  const largestQueue = SCALE_QUEUE_SIZES[SCALE_QUEUE_SIZES.length - 1];
  const arrivals = generateArrivals(
    population,
    traffic,
    seed,
    Math.ceil(largestQueue / 12) + 1,
  );
  const rows: ScaleBenchmarkRow[] = [];

  for (const queueSize of SCALE_QUEUE_SIZES) {
    const sourcePool = arrivals.slice(0, queueSize);
    const firstArrival = sourcePool[0].arrivalTime;
    const lastArrival = sourcePool[sourcePool.length - 1].arrivalTime;
    const arrivalRange = Math.max(0.001, lastArrival - firstArrival);
    const pool = sourcePool.map((player) => ({
      ...player,
      arrivalTime:
        -180 + ((player.arrivalTime - firstArrival) / arrivalRange) * 180,
    }));
    let now = 0;
    let baselinePlayers = baselineCandidates(pool, now, policy);
    let tailPlayers = tailAwareCandidates(pool, now, policy);

    while ((!baselinePlayers || !tailPlayers) && now < 1_200) {
      now += 5;
      baselinePlayers = baselineCandidates(pool, now, policy);
      tailPlayers = tailAwareCandidates(pool, now, policy);
    }
    if (!baselinePlayers || !tailPlayers) {
      throw new Error("A scale-test queue could not form a match.");
    }

    // Warm up the same decision path before collecting median timings.
    baselineCandidates(pool, now, policy);
    tailAwareCandidates(pool, now, policy);

    const baselineTimings: number[] = [];
    const tailTimings: number[] = [];
    let baselineEvaluation = matchObjective(
      baselinePlayers,
      snakeTeams(baselinePlayers),
      now,
    );
    let tailEvaluation = matchObjective(
      tailPlayers,
      optimizedTeams(tailPlayers),
      now,
    );

    for (let iteration = 0; iteration < iterations; iteration += 1) {
      const baselineStart = benchmarkClock();
      const selectedBaseline = baselineCandidates(pool, now, policy)!;
      baselineEvaluation = matchObjective(
        selectedBaseline,
        snakeTeams(selectedBaseline),
        now,
      );
      baselineTimings.push(benchmarkClock() - baselineStart);

      const tailStart = benchmarkClock();
      const selectedTail = tailAwareCandidates(pool, now, policy)!;
      tailEvaluation = matchObjective(
        selectedTail,
        optimizedTeams(selectedTail),
        now,
      );
      tailTimings.push(benchmarkClock() - tailStart);
    }

    const baselineRuntimeMs = percentile(baselineTimings, 0.5);
    const tailRuntimeMs = percentile(tailTimings, 0.5);
    rows.push({
      queueSize,
      baselineRuntimeMs,
      tailRuntimeMs,
      baselineThroughput: 1_000 / Math.max(0.0001, baselineRuntimeMs),
      tailThroughput: 1_000 / Math.max(0.0001, tailRuntimeMs),
      runtimeRatio: tailRuntimeMs / Math.max(0.0001, baselineRuntimeMs),
      baselineSpread: baselineEvaluation.spread,
      tailSpread: tailEvaluation.spread,
      baselineCost: baselineEvaluation.cost,
      tailCost: tailEvaluation.cost,
    });
  }

  const growthStart =
    rows.find((row) => row.queueSize >= 5_000) ?? rows[0];
  const last = rows[rows.length - 1];
  const withinBudget = rows.filter(
    (row) => row.tailRuntimeMs <= SCALE_LATENCY_BUDGET_MS,
  );

  return {
    rows,
    maxWithinBudget: withinBudget.at(-1)?.queueSize ?? 0,
    latencyBudgetMs: SCALE_LATENCY_BUDGET_MS,
    tailGrowthExponent:
      Math.log(
        Math.max(0.0001, last.tailRuntimeMs) /
          Math.max(0.0001, growthStart.tailRuntimeMs),
      ) / Math.log(last.queueSize / growthStart.queueSize),
    qualityWins: rows.filter((row) => row.tailCost < row.baselineCost).length,
    iterations,
    scenario: { population, traffic, policy, seed },
  };
}

export function runScenarioSweep(
  seed: number,
  runsPerScenario = SWEEP_RUNS,
  matchesPerRun = SWEEP_MATCHES_PER_RUN,
): ScenarioSweepResult {
  const rows: ScenarioSweepRow[] = [];
  let scenarioIndex = 0;

  for (const policy of SWEEP_POLICIES) {
    for (const traffic of SWEEP_TRAFFIC) {
      for (const population of SWEEP_POPULATIONS) {
        const comparison = runExperimentSuite({
          population,
          traffic,
          policy,
          seed: seed + scenarioIndex * 104_729,
          runs: runsPerScenario,
          matchesPerRun,
        });
        const baseline = {
          queueSeconds: comparison.baseline.queueSeconds,
          spread: comparison.baseline.spread,
          badMatchRate: comparison.baseline.badMatchRate,
          collapsed:
            comparison.baseline.badMatchRate >= COLLAPSE_BAD_MATCH_RATE,
        };
        const adaptive = {
          queueSeconds: comparison.adaptive.queueSeconds,
          spread: comparison.adaptive.spread,
          badMatchRate: comparison.adaptive.badMatchRate,
          collapsed:
            comparison.adaptive.badMatchRate >= COLLAPSE_BAD_MATCH_RATE,
        };

        rows.push({
          population,
          traffic,
          policy,
          baseline,
          adaptive,
          badMatchReduction:
            baseline.badMatchRate - adaptive.badMatchRate,
          extraWait: adaptive.queueSeconds - baseline.queueSeconds,
        });
        scenarioIndex += 1;
      }
    }
  }

  const biggestReduction = rows.reduce((best, row) =>
    row.badMatchReduction > best.badMatchReduction ? row : best,
  );

  return {
    rows,
    baselineCollapses: rows.filter((row) => row.baseline.collapsed).length,
    adaptiveCollapses: rows.filter((row) => row.adaptive.collapsed).length,
    qualityWins: rows.filter(
      (row) => row.adaptive.badMatchRate < row.baseline.badMatchRate,
    ).length,
    biggestReduction,
    runsPerScenario,
    matchesPerRun,
  };
}
