"use client";

import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Activity,
  BarChart3,
  Clock3,
  Cpu,
  Database,
  Download,
  Gauge,
  Grid3X3,
  Play,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Slider } from "@/components/ui/slider";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ABLATION_MATCHES_PER_RUN,
  ABLATION_RUNS,
  BAD_SPREAD_THRESHOLD,
  BAD_TEAM_GAP_THRESHOLD,
  MATCH_TARGET,
  MATCHES_PER_RUN,
  ORACLE_POOL_SIZE,
  ORACLE_SNAPSHOTS,
  PARETO_MATCHES_PER_RUN,
  PARETO_RUNS,
  RUN_COUNT,
  SCALE_ITERATIONS,
  SCALE_LATENCY_BUDGET_MS,
  SCALE_QUEUE_SIZES,
  SENSITIVITY_MATCHES_PER_RUN,
  SENSITIVITY_RUNS,
  SENSITIVITY_SPREAD_THRESHOLDS,
  SENSITIVITY_TEAM_GAP_THRESHOLDS,
  COLLAPSE_BAD_MATCH_RATE,
  SWEEP_MATCHES_PER_RUN,
  SWEEP_POLICIES,
  SWEEP_POPULATIONS,
  SWEEP_RUNS,
  SWEEP_TRAFFIC,
  runAblationStudy,
  runExperimentSuite,
  runOracleBenchmark,
  runParetoStudy,
  runScenarioSweep,
  runScaleBenchmark,
  runSensitivityStudy,
  type AblationStudyResult,
  type AblationVariantId,
  type Algorithm,
  type DisplayPlayer,
  type ExperimentComparison,
  type OracleBenchmarkResult,
  type ParetoStudyResult,
  type Policy,
  type ScenarioSweepRow,
  type ScenarioSweepResult,
  type ScaleBenchmarkResult,
  type SensitivityStudyResult,
  type Traffic,
} from "@/lib/matchmaking";

const policies: Array<{ value: Policy; label: string; note: string }> = [
  { value: "fast", label: "Fast queue", note: "Expands every 20s" },
  { value: "balanced", label: "Balanced", note: "Expands every 45s" },
  { value: "integrity", label: "Competitive", note: "Expands every 90s" },
];

const trafficOptions: Array<{ value: Traffic; label: string; detail: string }> = [
  { value: "peak", label: "Peak", detail: "9 PM" },
  { value: "late", label: "Late", detail: "12 AM" },
  { value: "overnight", label: "Overnight", detail: "3 AM" },
];

type SavedRunSummary = {
  id: string;
  createdAt: number;
  status: "queued" | "running" | "completed" | "failed";
  population: number;
  traffic: Traffic;
  policy: Policy;
  seed: number;
  runs: number;
  matchesPerRun: number;
  progress: number;
  durationMs: number | null;
  error: string | null;
};

type ExperimentScenario = {
  population: number;
  traffic: Traffic;
  policy: Policy;
  seed: number;
};

type SavedExperiment = SavedRunSummary & {
  result: ExperimentComparison | null;
};

async function fetchSavedExperiment(id: string): Promise<SavedExperiment> {
  const response = await fetch(`/api/experiments/${id}`, {
    cache: "no-store",
  });
  if (!response.ok) throw new Error("That saved run could not be loaded.");
  return (await response.json()) as SavedExperiment;
}

function formatTime(seconds: number) {
  const rounded = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(rounded / 60);
  return `${minutes}:${String(rounded % 60).padStart(2, "0")}`;
}

function formatTimeRange(low: number, high: number) {
  return `${formatTime(low)}–${formatTime(high)}`;
}

function rateTone(rate: number) {
  if (rate >= 75) return "border-[#7a2f3b] bg-[#461d28] text-[#ff9eaa]";
  if (rate >= COLLAPSE_BAD_MATCH_RATE) {
    return "border-[#744b2c] bg-[#3d2a1d] text-[#ffc07a]";
  }
  if (rate >= 25) return "border-[#60572b] bg-[#302e1b] text-[#e9dc78]";
  return "border-[#255748] bg-[#17372f] text-[#7ce4c9]";
}

function titleCase(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function sweepVerdict(row: ScenarioSweepRow) {
  if (row.baseline.collapsed && !row.adaptive.collapsed) return "Recovered";
  if (row.adaptive.collapsed) return "Collapsed";
  return "Stable";
}

function effectLabel(value: number) {
  return value >= 0
    ? `${value.toFixed(1)} pts fewer`
    : `${Math.abs(value).toFixed(1)} pts more`;
}

function formatRuntime(milliseconds: number) {
  return milliseconds < 0.1
    ? `${(milliseconds * 1_000).toFixed(0)} µs`
    : `${milliseconds.toFixed(2)} ms`;
}

function reductionTone(value: number) {
  if (value >= 40) return "border-[#277660] bg-[#18483c] text-[#a8f5df]";
  if (value >= 20) return "border-[#255748] bg-[#17372f] text-[#7ce4c9]";
  if (value >= 5) return "border-[#60572b] bg-[#302e1b] text-[#e9dc78]";
  return "border-[#744b2c] bg-[#3d2a1d] text-[#ffc07a]";
}

function Metric({
  icon: Icon,
  label,
  value,
  note,
  accent,
}: {
  icon: typeof Clock3;
  label: string;
  value: string;
  note: string;
  accent?: boolean;
}) {
  return (
    <article className="metric-grid relative min-w-0 overflow-hidden border border-border bg-card/85 p-4">
      <div className="absolute right-3 top-3 opacity-20">
        <Icon className="size-8" />
      </div>
      <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">
        {label}
      </p>
      <p
        className={`display-type mt-2 text-3xl leading-none ${
          accent ? "text-primary" : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="mt-2 text-xs text-muted-foreground">{note}</p>
    </article>
  );
}

function ParetoChart({ study }: { study: ParetoStudyResult }) {
  const width = 760;
  const height = 340;
  const margin = { left: 64, right: 24, top: 34, bottom: 54 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const queues = study.points.map((point) => point.queueSeconds);
  const rates = study.points.map((point) => point.badMatchRate);
  const minQueue = Math.max(0, Math.floor(Math.min(...queues) - 5));
  const maxQueue = Math.ceil(Math.max(...queues) + 5);
  const maxRate = Math.max(10, Math.ceil(Math.max(...rates) / 10) * 10);
  const x = (queue: number) =>
    margin.left + ((queue - minQueue) / (maxQueue - minQueue)) * chartWidth;
  const y = (rate: number) =>
    margin.top + (rate / maxRate) * chartHeight;
  const xTicks = [minQueue, (minQueue + maxQueue) / 2, maxQueue];
  const yTicks = [0, maxRate / 2, maxRate];
  const frontierPath = study.frontier
    .map((point) => `${x(point.queueSeconds)},${y(point.badMatchRate)}`)
    .join(" ");

  return (
    <div className="overflow-x-auto border border-border bg-[#09141b] p-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[720px]"
        role="img"
        aria-labelledby="pareto-chart-title pareto-chart-description"
      >
        <title id="pareto-chart-title">Queue time and bad-match Pareto frontier</title>
        <desc id="pareto-chart-description">
          Lower and farther left is better. The line connects configurations
          that trade shorter queues for fewer bad matches.
        </desc>
        <text x={margin.left} y="17" fill="#7ce4c9" fontSize="11" fontWeight="700">
          BETTER QUALITY ↑
        </text>
        {yTicks.map((tick) => (
          <g key={`y-${tick}`}>
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#21343e"
              strokeWidth="1"
            />
            <text
              x={margin.left - 10}
              y={y(tick) + 4}
              textAnchor="end"
              fill="#81939d"
              fontSize="11"
            >
              {tick.toFixed(0)}%
            </text>
          </g>
        ))}
        {xTicks.map((tick) => (
          <g key={`x-${tick}`}>
            <line
              x1={x(tick)}
              x2={x(tick)}
              y1={margin.top}
              y2={height - margin.bottom}
              stroke="#182a33"
              strokeWidth="1"
            />
            <text
              x={x(tick)}
              y={height - margin.bottom + 22}
              textAnchor="middle"
              fill="#81939d"
              fontSize="11"
            >
              {formatTime(tick)}
            </text>
          </g>
        ))}
        <polyline
          points={frontierPath}
          fill="none"
          stroke="#22e7c0"
          strokeWidth="2.5"
          strokeLinejoin="round"
          strokeLinecap="round"
          opacity="0.72"
        />
        {study.points.map((point, index) => {
          const recommended = point.id === study.recommended.id;
          const color = point.baseline
            ? "#ff5968"
            : recommended
              ? "#f3d177"
              : point.efficient
                ? "#22e7c0"
                : "#667781";
          const labelBelow = index % 2 === 0;
          return (
            <g key={point.id} opacity={point.efficient ? 1 : 0.45}>
              {recommended ? (
                <circle
                  cx={x(point.queueSeconds)}
                  cy={y(point.badMatchRate)}
                  r="10"
                  fill="none"
                  stroke="#f3d177"
                  strokeWidth="2"
                />
              ) : null}
              <circle
                cx={x(point.queueSeconds)}
                cy={y(point.badMatchRate)}
                r={recommended ? 5.5 : 4.5}
                fill={color}
                stroke="#071117"
                strokeWidth="2"
              >
                <title>
                  {point.label}: {formatTime(point.queueSeconds)} median queue, {point.badMatchRate.toFixed(1)}% bad matches
                </title>
              </circle>
              <text
                x={x(point.queueSeconds)}
                y={y(point.badMatchRate) + (labelBelow ? 18 : -10)}
                textAnchor="middle"
                fill={color}
                fontSize="10"
                fontWeight="700"
              >
                {point.label.toUpperCase()}
              </text>
            </g>
          );
        })}
        <text
          x={margin.left + chartWidth / 2}
          y={height - 8}
          textAnchor="middle"
          fill="#aab8bf"
          fontSize="11"
          fontWeight="700"
        >
          MEDIAN QUEUE TIME →
        </text>
      </svg>
    </div>
  );
}

function compactCount(value: number) {
  if (value >= 1_000) {
    const thousands = value / 1_000;
    return `${Number.isInteger(thousands) ? thousands.toFixed(0) : thousands.toFixed(1)}K`;
  }
  return value.toFixed(0);
}

function ScaleChart({ study }: { study: ScaleBenchmarkResult }) {
  const width = 760;
  const height = 340;
  const margin = { left: 64, right: 24, top: 28, bottom: 54 };
  const chartWidth = width - margin.left - margin.right;
  const chartHeight = height - margin.top - margin.bottom;
  const minSize = study.rows[0].queueSize;
  const maxSize = study.rows[study.rows.length - 1].queueSize;
  const maxLatency = Math.max(
    study.latencyBudgetMs,
    ...study.rows.map((row) => row.tailRuntimeMs),
  );
  const yMax = Math.max(10, Math.ceil(maxLatency / 25) * 25);
  const x = (size: number) =>
    margin.left +
    ((Math.log(size) - Math.log(minSize)) /
      (Math.log(maxSize) - Math.log(minSize))) *
      chartWidth;
  const y = (latency: number) =>
    margin.top + (latency / yMax) * chartHeight;
  const baselinePath = study.rows
    .map((row) => `${x(row.queueSize)},${y(row.baselineRuntimeMs)}`)
    .join(" ");
  const tailPath = study.rows
    .map((row) => `${x(row.queueSize)},${y(row.tailRuntimeMs)}`)
    .join(" ");
  const yTicks = [0, yMax / 2, yMax];
  const xTicks = study.rows.filter(
    (_, index) => index === 0 || index === 3 || index === 6 || index === study.rows.length - 1,
  );

  return (
    <div className="overflow-x-auto border border-border bg-[#09141b] p-3">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="min-w-[720px]"
        role="img"
        aria-labelledby="scale-chart-title scale-chart-description"
      >
        <title id="scale-chart-title">Decision latency by candidate queue size</title>
        <desc id="scale-chart-description">
          Baseline and Tail-Aware median decision latency from fifty to fifty
          thousand queued candidates. The dashed line marks the fifty
          millisecond budget.
        </desc>
        {yTicks.map((tick) => (
          <g key={`scale-y-${tick}`}>
            <line
              x1={margin.left}
              x2={width - margin.right}
              y1={y(tick)}
              y2={y(tick)}
              stroke="#21343e"
              strokeWidth="1"
            />
            <text
              x={margin.left - 10}
              y={y(tick) + 4}
              textAnchor="end"
              fill="#81939d"
              fontSize="11"
            >
              {tick.toFixed(0)} ms
            </text>
          </g>
        ))}
        {xTicks.map((row) => (
          <g key={`scale-x-${row.queueSize}`}>
            <line
              x1={x(row.queueSize)}
              x2={x(row.queueSize)}
              y1={margin.top}
              y2={height - margin.bottom}
              stroke="#182a33"
              strokeWidth="1"
            />
            <text
              x={x(row.queueSize)}
              y={height - margin.bottom + 22}
              textAnchor="middle"
              fill="#81939d"
              fontSize="11"
            >
              {compactCount(row.queueSize)}
            </text>
          </g>
        ))}
        <line
          x1={margin.left}
          x2={width - margin.right}
          y1={y(study.latencyBudgetMs)}
          y2={y(study.latencyBudgetMs)}
          stroke="#f3d177"
          strokeWidth="1.5"
          strokeDasharray="7 6"
        />
        <text
          x={width - margin.right}
          y={y(study.latencyBudgetMs) - 7}
          textAnchor="end"
          fill="#f3d177"
          fontSize="10"
          fontWeight="700"
        >
          {study.latencyBudgetMs} MS BUDGET
        </text>
        <polyline
          points={baselinePath}
          fill="none"
          stroke="#ff5968"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        <polyline
          points={tailPath}
          fill="none"
          stroke="#22e7c0"
          strokeWidth="2.5"
          strokeLinejoin="round"
        />
        {study.rows.flatMap((row) => [
          <circle
            key={`baseline-${row.queueSize}`}
            cx={x(row.queueSize)}
            cy={y(row.baselineRuntimeMs)}
            r="4"
            fill="#ff5968"
            stroke="#071117"
            strokeWidth="2"
          >
            <title>
              Baseline at {row.queueSize.toLocaleString()}: {formatRuntime(row.baselineRuntimeMs)}
            </title>
          </circle>,
          <circle
            key={`tail-${row.queueSize}`}
            cx={x(row.queueSize)}
            cy={y(row.tailRuntimeMs)}
            r="4"
            fill="#22e7c0"
            stroke="#071117"
            strokeWidth="2"
          >
            <title>
              Tail-Aware at {row.queueSize.toLocaleString()}: {formatRuntime(row.tailRuntimeMs)}
            </title>
          </circle>,
        ])}
        <text
          x={margin.left + chartWidth / 2}
          y={height - 8}
          textAnchor="middle"
          fill="#aab8bf"
          fontSize="11"
          fontWeight="700"
        >
          CANDIDATES SCANNED — LOG SCALE →
        </text>
      </svg>
    </div>
  );
}

function RankMark({ rank }: { rank: string }) {
  const radiant = rank === "RADIANT";
  const ascendant = rank.includes("ASCENDANT");
  return (
    <span
      className={`grid size-8 shrink-0 rotate-45 place-items-center border ${
        radiant
          ? "border-[#f3d177] bg-[#6d5e35] text-[#fff0b5]"
          : ascendant
            ? "border-[#83d6c0] bg-[#1d5a4f] text-[#b6f8e6]"
            : "border-[#e66588] bg-[#692d46] text-[#ffb4c8]"
      }`}
      aria-hidden="true"
    >
      <span className="-rotate-45 text-[10px] font-black">
        {radiant ? "R" : ascendant ? "A" : "I"}
      </span>
    </span>
  );
}

function TeamRoster({
  team,
  players,
}: {
  team: "A" | "B";
  players: DisplayPlayer[];
}) {
  const isTeamA = team === "A";
  const sortedPlayers = [...players].sort((a, b) => b.mmr - a.mmr);
  const averageMmr = Math.round(
    sortedPlayers.reduce((sum, player) => sum + player.mmr, 0) /
      Math.max(1, sortedPlayers.length),
  );

  return (
    <section
      className={`min-w-0 border ${
        isTeamA ? "border-primary/45" : "border-destructive/45"
      }`}
      aria-label={`Team ${team}, ${sortedPlayers.length} players`}
    >
      <div
        className={`flex items-center justify-between gap-3 border-b px-4 py-3 ${
          isTeamA
            ? "border-primary/35 bg-primary/10"
            : "border-destructive/35 bg-destructive/10"
        }`}
      >
        <div>
          <p
            className={`text-sm font-black uppercase tracking-[0.16em] ${
              isTeamA ? "text-primary" : "text-destructive"
            }`}
          >
            Team {team}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {sortedPlayers.length} players · sorted by MMR
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-lg font-black">{averageMmr}</p>
          <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
            Avg MMR
          </p>
        </div>
      </div>

      <Table>
        <TableHeader>
          <TableRow className="border-border bg-[#162630] hover:bg-[#162630]">
            <TableHead className="min-w-[185px] px-3 text-xs font-black uppercase tracking-wider text-muted-foreground">
              Player
            </TableHead>
            <TableHead className="text-xs font-black uppercase tracking-wider text-muted-foreground">
              Rank
            </TableHead>
            <TableHead className="text-right text-xs font-black uppercase tracking-wider text-muted-foreground">
              MMR
            </TableHead>
            <TableHead className="text-right text-xs font-black uppercase tracking-wider text-muted-foreground">
              Queue
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {sortedPlayers.map((player) => (
            <TableRow
              key={player.name}
              className={`border-[#162a34] hover:brightness-110 ${
                isTeamA
                  ? "bg-[linear-gradient(90deg,rgba(24,155,139,.24),rgba(12,49,52,.18))]"
                  : "bg-[linear-gradient(90deg,rgba(185,55,76,.24),rgba(62,27,38,.18))]"
              }`}
            >
              <TableCell
                className={`border-l-4 px-3 py-2.5 ${
                  isTeamA ? "border-l-primary" : "border-l-destructive"
                }`}
              >
                <div className="flex items-center gap-3">
                  <RankMark rank={player.rank} />
                  <div>
                    <p className="text-sm font-black tracking-wide">
                      {player.name}
                    </p>
                    <p className="text-[11px] font-bold tracking-[0.12em] text-muted-foreground">
                      {player.role}
                    </p>
                  </div>
                </div>
              </TableCell>
              <TableCell>
                <p className="text-xs font-black tracking-wide">{player.rank}</p>
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {player.rank === "RADIANT" ? `#${player.rr}` : `${player.rr} RR`}
                </p>
              </TableCell>
              <TableCell className="text-right font-mono text-sm font-bold">
                {player.mmr}
              </TableCell>
              <TableCell className="text-right font-mono text-sm">
                {formatTime(player.wait)}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </section>
  );
}

export function RiftQueueWorkspace({
  mode,
}: {
  mode: "simulator" | "experiments";
}) {
  const searchParams = useSearchParams();
  const [population, setPopulation] = useState(75);
  const [traffic, setTraffic] = useState<Traffic>("late");
  const [policy, setPolicy] = useState<Policy>("balanced");
  const [algorithm, setAlgorithm] = useState<Algorithm>("tail-aware");
  const [seed, setSeed] = useState(4817);
  const [running, setRunning] = useState(false);
  const [runProgress, setRunProgress] = useState(0);
  const [completedRunCount, setCompletedRunCount] = useState(0);
  const [runError, setRunError] = useState<string | null>(null);
  const [lastRunId, setLastRunId] = useState<string | null>(null);
  const [savedRuns, setSavedRuns] = useState<SavedRunSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [sweep, setSweep] = useState<ScenarioSweepResult | null>(null);
  const [sweepRunning, setSweepRunning] = useState(false);
  const [sweepPolicy, setSweepPolicy] = useState<Policy>("balanced");
  const [ablation, setAblation] = useState<AblationStudyResult | null>(null);
  const [ablationRunning, setAblationRunning] = useState(false);
  const [sensitivity, setSensitivity] =
    useState<SensitivityStudyResult | null>(null);
  const [sensitivityRunning, setSensitivityRunning] = useState(false);
  const [pareto, setPareto] = useState<ParetoStudyResult | null>(null);
  const [paretoRunning, setParetoRunning] = useState(false);
  const [oracle, setOracle] = useState<OracleBenchmarkResult | null>(null);
  const [oracleRunning, setOracleRunning] = useState(false);
  const [scale, setScale] = useState<ScaleBenchmarkResult | null>(null);
  const [scaleRunning, setScaleRunning] = useState(false);
  const [lastRunScenario, setLastRunScenario] = useState<ExperimentScenario>({
    population: 75,
    traffic: "late" as Traffic,
    policy: "balanced" as Policy,
    seed: 4817,
  });
  const [comparison, setComparison] = useState<ExperimentComparison>(() =>
    runExperimentSuite({
      population: 75,
      traffic: "late",
      policy: "balanced",
      seed: 4817,
    }),
  );
  const baseline = comparison.baseline;
  const adaptive = comparison.adaptive;
  const result = algorithm === "baseline" ? baseline : adaptive;
  const hasPendingChanges =
    population !== lastRunScenario.population ||
    traffic !== lastRunScenario.traffic ||
    policy !== lastRunScenario.policy;
  const teamA = result.players.filter((player) => player.team === "A");
  const teamB = result.players.filter((player) => player.team === "B");

  useEffect(() => {
    let active = true;
    fetch("/api/experiments", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) throw new Error("Saved runs are unavailable.");
        return (await response.json()) as { runs: SavedRunSummary[] };
      })
      .then((data) => {
        if (active) setSavedRuns(data.runs);
      })
      .catch(() => {
        if (active) setSavedRuns([]);
      })
      .finally(() => {
        if (active) setHistoryLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const qualityImprovement = Math.round(
    ((baseline.badMatchRate - adaptive.badMatchRate) /
      Math.max(0.1, baseline.badMatchRate)) *
      100,
  );
  const extraWait = Math.round(adaptive.queueSeconds - baseline.queueSeconds);
  const qualityLabel =
    qualityImprovement >= 0
      ? `-${qualityImprovement}%`
      : `+${Math.abs(qualityImprovement)}%`;
  const waitLabel = extraWait >= 0 ? `+${extraWait}` : `${extraWait}`;
  const waitDescription =
    extraWait >= 0
      ? "additional median wait using the tail-aware matcher."
      : "less median wait using the tail-aware matcher.";
  const qualityDescription =
    qualityImprovement >= 0
      ? "fewer extreme lobby outcomes in this run."
      : "more extreme lobby outcomes in this run.";

  async function refreshRunHistory() {
    const response = await fetch("/api/experiments", { cache: "no-store" });
    if (!response.ok) return;
    const data = (await response.json()) as { runs: SavedRunSummary[] };
    setSavedRuns(data.runs);
  }

  async function runExperiment() {
    setRunning(true);
    setRunProgress(0);
    setCompletedRunCount(0);
    setRunError(null);
    const nextScenario: ExperimentScenario = {
      population,
      traffic,
      policy,
      seed: seed + 137,
    };
    const idempotencyKey = crypto.randomUUID();

    const applyCompletedExperiment = (saved: SavedExperiment) => {
      if (!saved.result) throw new Error("The run ended before results were saved.");
      setComparison(saved.result);
      setSeed(nextScenario.seed);
      setLastRunScenario(nextScenario);
      setLastRunId(saved.id);
      setRunProgress(100);
    };

    const resumeExistingExperiment = async (id: string) => {
      for (let attempt = 0; attempt < 120; attempt += 1) {
        const saved = await fetchSavedExperiment(id);
        setLastRunId(saved.id);
        setRunProgress(saved.progress);
        if (saved.status === "completed") {
          applyCompletedExperiment(saved);
          return;
        }
        if (saved.status === "failed") {
          throw new Error(saved.error ?? "The experiment failed.");
        }
        await new Promise((resolve) => setTimeout(resolve, 500));
      }
      throw new Error("The existing run is still processing. Check Saved Runs shortly.");
    };

    try {
      const requestOptions = {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "idempotency-key": idempotencyKey,
        },
        body: JSON.stringify(nextScenario),
      };
      let response: Response;
      try {
        response = await fetch("/api/experiments", requestOptions);
      } catch {
        response = await fetch("/api/experiments", requestOptions);
      }
      if (!response.ok || !response.body) {
        const body = (await response.json().catch(() => null)) as
          | { error?: string }
          | null;
        throw new Error(body?.error ?? "The server could not start this run.");
      }

      if (response.status === 202) {
        const reused = (await response.json()) as { id?: string };
        if (!reused.id) throw new Error("The server could not resume this run.");
        await resumeExistingExperiment(reused.id);
        await refreshRunHistory();
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let completed = false;
      let failure: string | null = null;

      const handleLine = (line: string) => {
        if (!line.trim()) return;
        const event = JSON.parse(line) as {
          type: "started" | "progress" | "completed" | "failed";
          id: string;
          progress?: number;
          completedRuns?: number;
          result?: ExperimentComparison;
          message?: string;
        };
        setLastRunId(event.id);
        if (typeof event.progress === "number") {
          setRunProgress(event.progress);
        }
        if (typeof event.completedRuns === "number") {
          setCompletedRunCount(event.completedRuns);
        }
        if (event.type === "completed" && event.result) {
          setComparison(event.result);
          setSeed(nextScenario.seed);
          setLastRunScenario(nextScenario);
          setRunProgress(100);
          completed = true;
        }
        if (event.type === "failed") {
          failure = event.message ?? "The experiment failed.";
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        buffer += decoder.decode(value, { stream: !done });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines.forEach(handleLine);
        if (done) break;
      }
      handleLine(buffer);

      if (failure) throw new Error(failure);
      if (!completed) throw new Error("The run ended before results were saved.");
      await refreshRunHistory();
    } catch (error) {
      setRunError(
        error instanceof Error ? error.message : "The experiment failed.",
      );
      await refreshRunHistory().catch(() => undefined);
    } finally {
      setRunning(false);
    }
  }

  const loadSavedRun = useCallback(async (id: string) => {
    setRunError(null);
    try {
      const saved = await fetchSavedExperiment(id);
      if (!saved.result) throw new Error("That run has no completed result.");
      const scenario: ExperimentScenario = {
        population: saved.population,
        traffic: saved.traffic,
        policy: saved.policy,
        seed: saved.seed,
      };
      setComparison(saved.result);
      setPopulation(saved.population);
      setTraffic(saved.traffic);
      setPolicy(saved.policy);
      setSeed(saved.seed);
      setLastRunScenario(scenario);
      setLastRunId(saved.id);
      setRunProgress(100);
    } catch (error) {
      setRunError(
        error instanceof Error ? error.message : "That run could not be loaded.",
      );
    }
  }, []);

  const requestedRunId = searchParams.get("run");
  useEffect(() => {
    if (mode !== "simulator" || !requestedRunId) return;

    let active = true;
    fetchSavedExperiment(requestedRunId)
      .then((saved) => {
        if (!active) return;
        if (!saved.result) throw new Error("That run has no completed result.");
        setComparison(saved.result);
        setPopulation(saved.population);
        setTraffic(saved.traffic);
        setPolicy(saved.policy);
        setSeed(saved.seed);
        setLastRunScenario({
          population: saved.population,
          traffic: saved.traffic,
          policy: saved.policy,
          seed: saved.seed,
        });
        setLastRunId(saved.id);
        setRunProgress(100);
      })
      .catch((error: unknown) => {
        if (active) {
          setRunError(
            error instanceof Error ? error.message : "That run could not be loaded.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [mode, requestedRunId]);

  function runSweep() {
    setSweepRunning(true);
    window.setTimeout(() => {
      setSweep(runScenarioSweep(seed + 90_210));
      setSweepRunning(false);
    }, 40);
  }

  function runAblation() {
    setAblationRunning(true);
    window.setTimeout(() => {
      setAblation(
        runAblationStudy({
          population,
          traffic,
          policy,
          seed: seed + 31_415,
        }),
      );
      setAblationRunning(false);
    }, 40);
  }

  function runSensitivity() {
    setSensitivityRunning(true);
    window.setTimeout(() => {
      setSensitivity(
        runSensitivityStudy({
          population,
          traffic,
          policy,
          seed: seed + 47_051,
        }),
      );
      setSensitivityRunning(false);
    }, 40);
  }

  function runPareto() {
    setParetoRunning(true);
    window.setTimeout(() => {
      setPareto(
        runParetoStudy({
          population,
          traffic,
          policy,
          seed: seed + 61_986,
        }),
      );
      setParetoRunning(false);
    }, 40);
  }

  function runOracle() {
    setOracleRunning(true);
    window.setTimeout(() => {
      setOracle(
        runOracleBenchmark({
          population,
          traffic,
          policy,
          seed: seed + 76_603,
        }),
      );
      setOracleRunning(false);
    }, 40);
  }

  function runScale() {
    setScaleRunning(true);
    window.setTimeout(() => {
      setScale(
        runScaleBenchmark({
          population,
          traffic,
          policy,
          seed: seed + 91_739,
        }),
      );
      setScaleRunning(false);
    }, 40);
  }

  const visibleSweepRows =
    sweep?.rows.filter((row) => row.policy === sweepPolicy) ?? [];
  const paretoBaseline = pareto?.points.find((point) => point.baseline);
  const paretoBestQuality = pareto?.frontier.reduce((best, point) =>
    point.badMatchRate < best.badMatchRate ? point : best,
  );
  const scaleLargest = scale?.rows.at(-1);
  const scaleFirstOverBudget = scale?.rows.find(
    (row) => row.tailRuntimeMs > scale.latencyBudgetMs,
  );

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1540px]">
        <div className="grid items-start gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="border border-border bg-[#0a151d]/95 xl:sticky xl:top-24">
            <div className="border-b border-border px-5 py-4">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                {mode === "simulator" ? "Simulation controls" : "Study controls"}
              </p>
              <h1 className="display-type mt-1 text-2xl">QUEUE CONDITIONS</h1>
            </div>

            <div className="space-y-6 p-5">
              <section>
                <div className="mb-3 flex items-end justify-between">
                  <label
                    className="text-sm font-bold uppercase tracking-wide"
                    htmlFor="population"
                  >
                    Population
                  </label>
                  <span className="display-type text-xl text-primary">
                    {population}%
                  </span>
                </div>
                <Slider
                  id="population"
                  value={[population]}
                  onValueChange={(value) => setPopulation(value[0])}
                  min={25}
                  max={100}
                  step={25}
                  aria-label="Concurrent high-ELO population"
                  className="[&_[data-slot=slider-range]]:bg-primary [&_[data-slot=slider-thumb]]:rounded-none [&_[data-slot=slider-thumb]]:border-primary [&_[data-slot=slider-thumb]]:bg-[#d9fff7] [&_[data-slot=slider-track]]:rounded-none [&_[data-slot=slider-track]]:bg-[#1c303a]"
                />
                <div className="mt-2 flex justify-between text-[11px] font-bold text-muted-foreground">
                  <span>25</span>
                  <span>50</span>
                  <span>75</span>
                  <span>100</span>
                </div>
              </section>

              <section>
                <p className="mb-3 text-sm font-bold uppercase tracking-wide">
                  Time of day
                </p>
                <RadioGroup
                  value={traffic}
                  onValueChange={(value) => setTraffic(value as Traffic)}
                  className="grid grid-cols-3 gap-2"
                >
                  {trafficOptions.map((option) => (
                    <label
                      key={option.value}
                      className={`cursor-pointer border p-2 text-center transition-colors ${
                        traffic === option.value
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border bg-secondary/45 text-muted-foreground hover:border-[#38515d]"
                      }`}
                    >
                      <RadioGroupItem value={option.value} className="sr-only" />
                      <span className="block text-xs font-black uppercase">
                        {option.label}
                      </span>
                      <span className="mt-1 block text-[11px]">{option.detail}</span>
                    </label>
                  ))}
                </RadioGroup>
              </section>

              <section>
                <p className="mb-3 text-sm font-bold uppercase tracking-wide">
                  Matchmaking policy
                </p>
                <RadioGroup
                  value={policy}
                  onValueChange={(value) => setPolicy(value as Policy)}
                  className="gap-2"
                >
                  {policies.map((option) => (
                    <label
                      key={option.value}
                      className={`flex cursor-pointer items-center gap-3 border px-3 py-3 transition-colors ${
                        policy === option.value
                          ? "border-primary bg-primary/10"
                          : "border-border bg-secondary/30 hover:border-[#38515d]"
                      }`}
                    >
                      <RadioGroupItem value={option.value} />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-black uppercase">
                          {option.label}
                        </span>
                        <span className="block text-xs text-muted-foreground">
                          {option.note}
                        </span>
                      </span>
                    </label>
                  ))}
                </RadioGroup>
              </section>

              {mode === "simulator" ? (
                <>
                  <section>
                    <p className="mb-3 text-sm font-bold uppercase tracking-wide">
                      Matcher
                    </p>
                    <div
                      className="grid grid-cols-2 gap-2"
                      role="group"
                      aria-label="Matchmaking algorithm"
                    >
                      {(["baseline", "tail-aware"] as Algorithm[]).map((value) => (
                        <Button
                          key={value}
                          type="button"
                          variant="outline"
                          onClick={() => setAlgorithm(value)}
                          aria-pressed={algorithm === value}
                          className={`h-auto rounded-none px-3 py-3 uppercase ${
                            algorithm === value
                              ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                              : "border-border bg-secondary/30 text-muted-foreground"
                          }`}
                        >
                          {value === "baseline" ? "Baseline" : "Tail-aware"}
                        </Button>
                      ))}
                    </div>
                  </section>

                  <Button
                    type="button"
                    onClick={runExperiment}
                    disabled={running}
                    className="cut-corners h-12 w-full rounded-none bg-destructive text-sm font-black uppercase tracking-[0.12em] text-white hover:bg-[#ff5b68]"
                  >
                    {running ? (
                      <RefreshCw className="animate-spin" />
                    ) : (
                      <Play className="fill-current" />
                    )}
                    {running
                      ? `Running ${RUN_COUNT} queue trials`
                      : hasPendingChanges
                        ? `Apply settings & run ${MATCH_TARGET.toLocaleString()}`
                        : `Run ${MATCH_TARGET.toLocaleString()} matches`}
                  </Button>
                  {hasPendingChanges && !running ? (
                    <div
                      className="border border-[#8f6434] bg-[#3d2a1d] px-3 py-2.5 text-xs leading-5 text-[#ffc07a]"
                      role="status"
                    >
                      Settings changed. The results still show the previous run.
                      Run the simulation to apply {population}% · {titleCase(traffic)} ·{" "}
                      {policy === "integrity" ? "Competitive" : titleCase(policy)}.
                    </div>
                  ) : null}
                </>
              ) : (
                <p className="border border-border bg-secondary/20 px-3 py-3 text-sm leading-6 text-muted-foreground">
                  These conditions are shared by every focused study on this page.
                </p>
              )}
            </div>
          </aside>

          <section
            className={`min-w-0 transition-opacity duration-300 ${
              running ? "opacity-45" : "opacity-100"
            }`}
            aria-live="polite"
          >
            {mode === "simulator" ? (
              <>
            <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  Run #{lastRunScenario.seed}
                </p>
                <h2 className="display-type mt-1 text-3xl sm:text-4xl">
                  QUEUE RESULTS
                </h2>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                  {lastRunScenario.population}% population ·{" "}
                  {titleCase(lastRunScenario.traffic)} ·{" "}
                  {lastRunScenario.policy === "integrity"
                    ? "Competitive"
                    : titleCase(lastRunScenario.policy)}
                </p>
              </div>
              <p className="max-w-xl text-sm leading-6 text-muted-foreground">
                {result.runs} independent runs ×{" "}
                {MATCHES_PER_RUN.toLocaleString()} matches. Within every run,
                both matchers received the same player-arrival stream.
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
              <Metric
                icon={Clock3}
                label="Median queue"
                value={formatTime(result.queueSeconds)}
                note={`95% CI ${formatTimeRange(
                  result.confidence.queueSeconds.low,
                  result.confidence.queueSeconds.high,
                )} · P95 ${formatTime(result.p95QueueSeconds)}`}
              />
              <Metric
                icon={Activity}
                label="Lobby spread"
                value={`${Math.round(result.spread)}`}
                note={`95% CI ${Math.round(
                  result.confidence.spread.low,
                )}–${Math.round(result.confidence.spread.high)} MMR`}
                accent
              />
              <Metric
                icon={ShieldCheck}
                label="Team gap"
                value={`${Math.round(result.teamGap)}`}
                note={`95% CI ${result.confidence.teamGap.low.toFixed(
                  1,
                )}–${result.confidence.teamGap.high.toFixed(1)} MMR`}
              />
              <Metric
                icon={BarChart3}
                label="Bad match rate"
                value={`${result.badMatchRate.toFixed(1)}%`}
                note={`95% CI ${result.confidence.badMatchRate.low.toFixed(
                  1,
                )}–${result.confidence.badMatchRate.high.toFixed(1)}%`}
              />
            </div>

            <div className="mt-3 border border-border bg-[#0a151d]/95">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3">
                <div className="flex items-center gap-2">
                  <Database className="size-4 text-primary" />
                  <div>
                    <h3 className="text-sm font-black uppercase tracking-[0.14em]">
                      Experiment record
                    </h3>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {lastRunId
                        ? `Saved as ${lastRunId.slice(0, 8)}`
                        : "The opening example is not saved yet."}
                    </p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {lastRunId ? (
                    <>
                      <a
                        href={`/api/experiments/${lastRunId}/download?format=json`}
                        className="inline-flex h-8 items-center gap-2 border border-border bg-secondary/30 px-3 text-xs font-bold uppercase transition-colors hover:border-primary hover:text-primary"
                      >
                        <Download className="size-4" /> JSON
                      </a>
                      <a
                        href={`/api/experiments/${lastRunId}/download?format=csv`}
                        className="inline-flex h-8 items-center gap-2 border border-border bg-secondary/30 px-3 text-xs font-bold uppercase transition-colors hover:border-primary hover:text-primary"
                      >
                        <Download className="size-4" /> CSV
                      </a>
                    </>
                  ) : (
                    <span className="text-xs text-muted-foreground">
                      Save a run to unlock exports.
                    </span>
                  )}
                </div>
              </div>

              {running ? (
                <div className="border-b border-border px-4 py-3" role="status">
                  <div className="mb-2 flex items-center justify-between gap-3 text-xs font-bold uppercase tracking-wider">
                    <span className="text-primary">
                      Running trial {Math.min(completedRunCount + 1, RUN_COUNT)} of {RUN_COUNT}
                    </span>
                    <span>{runProgress}%</span>
                  </div>
                  <div
                    className="h-2 overflow-hidden bg-[#1c303a]"
                    role="progressbar"
                    aria-label="Experiment progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={runProgress}
                  >
                    <div
                      className="h-full bg-primary transition-[width] duration-200"
                      style={{ width: `${runProgress}%` }}
                    />
                  </div>
                </div>
              ) : null}

              {runError ? (
                <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-[#ff9eaa]" role="alert">
                  {runError}
                </div>
              ) : null}

              <div className="px-4 py-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                    Recent saved runs
                  </p>
                  <span className="text-[11px] text-muted-foreground">
                    {historyLoading ? "Loading…" : `${savedRuns.length} shown`}
                  </span>
                </div>
                {!historyLoading && savedRuns.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Run the simulation once to create the first saved record.
                  </p>
                ) : (
                  <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">
                    {savedRuns.slice(0, 4).map((saved) => (
                      <div
                        key={saved.id}
                        className="flex min-w-0 items-center justify-between gap-3 border border-border bg-secondary/20 px-3 py-2"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-xs font-black uppercase tracking-wide">
                            {saved.population}% · {titleCase(saved.traffic)} ·{" "}
                            {saved.policy === "integrity"
                              ? "Competitive"
                              : titleCase(saved.policy)}
                          </p>
                          <p className="mt-1 text-[11px] text-muted-foreground">
                            #{saved.seed} · {saved.status}
                          </p>
                        </div>
                        {saved.status === "completed" ? (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={running}
                            onClick={() => loadSavedRun(saved.id)}
                            className="h-8 shrink-0 rounded-none border-border px-2 text-[11px] uppercase"
                          >
                            Load
                          </Button>
                        ) : (
                          <span className="shrink-0 text-[11px] font-bold text-muted-foreground">
                            {saved.progress}%
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="mt-5 border border-border bg-card/90">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-[#111f29] px-4 py-3">
                <div className="flex items-center gap-2">
                  <Users className="size-4 text-primary" />
                  <h3 className="text-sm font-black uppercase tracking-[0.14em]">
                    Representative lobby
                  </h3>
                </div>
                <div className="flex items-center gap-4 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <span>5 vs 5 · same simulated match</span>
                </div>
              </div>
              <div className="grid gap-3 p-3 xl:grid-cols-2">
                <TeamRoster team="A" players={teamA} />
                <TeamRoster team="B" players={teamB} />
              </div>
            </div>

            <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,.75fr)]">
              <article className="border border-border bg-card/90 p-5">
                <div className="mb-5 flex items-start justify-between gap-4">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                      Algorithm comparison
                    </p>
                    <h3 className="display-type mt-1 text-2xl">
                      QUALITY VS. WAIT
                    </h3>
                  </div>
                  <Sparkles className="size-5 text-primary" />
                </div>
                <div className="space-y-5">
                  {[
                    {
                      name: "Baseline + Snake",
                      data: baseline,
                      color: "bg-muted-foreground",
                    },
                    {
                      name: "Tail + Optimized",
                      data: adaptive,
                      color: "bg-primary",
                    },
                  ].map((row) => (
                    <div
                      key={row.name}
                      className="grid grid-cols-[124px_minmax(0,1fr)] gap-3"
                    >
                      <p className="pt-0.5 text-sm font-black uppercase">
                        {row.name}
                      </p>
                      <div className="space-y-2">
                        <div>
                          <div className="mb-1 flex justify-between text-[11px] uppercase text-muted-foreground">
                            <span>Queue time</span>
                            <span>{formatTime(row.data.queueSeconds)}</span>
                          </div>
                          <div className="h-2 bg-secondary">
                            <div
                              className={`h-full ${row.color}`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  (row.data.queueSeconds /
                                    Math.max(
                                      baseline.queueSeconds,
                                      adaptive.queueSeconds,
                                    )) *
                                    100,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                        <div>
                          <div className="mb-1 flex justify-between text-[11px] uppercase text-muted-foreground">
                            <span>Bad match rate</span>
                            <span>{row.data.badMatchRate.toFixed(1)}%</span>
                          </div>
                          <div className="h-2 bg-secondary">
                            <div
                              className={`h-full ${row.color}`}
                              style={{
                                width: `${Math.min(
                                  100,
                                  (row.data.badMatchRate /
                                    Math.max(
                                      1,
                                      baseline.badMatchRate,
                                      adaptive.badMatchRate,
                                    )) *
                                    100,
                                )}%`,
                              }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className="cut-corners border border-primary/35 bg-[linear-gradient(145deg,rgba(34,231,192,.13),rgba(11,27,35,.95)_52%)] p-5">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  Tradeoff readout
                </p>
                <p className="display-type mt-4 text-4xl leading-none text-foreground">
                  {waitLabel}
                  <span className="ml-1 text-xl text-muted-foreground">SEC</span>
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {waitDescription}
                </p>
                <div className="my-4 h-px bg-border" />
                <p className="display-type text-4xl leading-none text-primary">
                  {qualityLabel}
                </p>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  {qualityDescription}
                </p>
              </article>
            </div>

              </>
            ) : (
              <div className="mb-5 border border-border bg-[linear-gradient(135deg,rgba(34,231,192,.1),rgba(10,21,29,.96)_55%)] p-5 sm:p-6">
                <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                  Research workspace
                </p>
                <h2 className="display-type mt-2 text-3xl sm:text-4xl">
                  FOCUSED EXPERIMENTS
                </h2>
                <p className="mt-3 max-w-3xl text-base leading-7 text-muted-foreground">
                  Each study isolates one engineering question. Choose queue conditions once,
                  then run only the analysis you need instead of scanning a single oversized dashboard.
                </p>
              </div>
            )}

            {mode === "experiments" ? (
              <>

            <article className="mt-5 border border-border bg-card/90">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-[#111f29] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center border border-primary/40 bg-primary/10 text-primary">
                    <ShieldCheck className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                      Controlled experiment
                    </p>
                    <h3 className="display-type mt-1 text-2xl">
                      ABLATION STUDY
                    </h3>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={runAblation}
                  disabled={ablationRunning}
                  className="cut-corners h-11 rounded-none bg-primary px-5 font-black uppercase tracking-[0.1em] text-primary-foreground hover:bg-primary/90"
                >
                  {ablationRunning ? (
                    <RefreshCw className="animate-spin" />
                  ) : (
                    <Play className="fill-current" />
                  )}
                  {ablationRunning
                    ? "Separating the effects"
                    : ablation
                      ? "Rerun controlled test"
                      : "Run controlled test"}
                </Button>
              </div>

              {!ablation ? (
                <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <p className="max-w-3xl text-base leading-7 text-foreground">
                      Find out whether the improvement comes from choosing a
                      better group of ten players, dividing those players into
                      fairer teams, or both.
                    </p>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                      All four systems receive the same arrivals and queue
                      settings. Only candidate selection and team balancing are
                      changed, one piece at a time.
                    </p>
                  </div>
                  <div className="border border-border bg-secondary/30 px-5 py-4 text-center">
                    <p className="display-type text-3xl text-primary">
                      {(ABLATION_RUNS * ABLATION_MATCHES_PER_RUN * 4).toLocaleString()}
                    </p>
                    <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                      Total matches
                    </p>
                  </div>
                </div>
              ) : (
                <div className="p-5">
                  <div className="mb-4">
                    <p className="text-sm leading-6 text-muted-foreground">
                      {ablation.runs} runs × {ablation.matchesPerRun} matches per
                      system under {ablation.scenario.population}% ·{" "}
                      {titleCase(ablation.scenario.traffic)} ·{" "}
                      {ablation.scenario.policy === "integrity"
                        ? "Competitive"
                        : titleCase(ablation.scenario.policy)}{" "}
                      conditions.
                    </p>
                  </div>

                  <div className="overflow-x-auto">
                    <div className="grid min-w-[720px] grid-cols-[170px_repeat(2,minmax(250px,1fr))] border-l border-t border-border">
                      <div className="border-b border-r border-border bg-[#162630] p-3 text-xs font-black uppercase tracking-wider text-muted-foreground">
                        Candidate selection
                      </div>
                      <div className="border-b border-r border-border bg-[#162630] p-3 text-center">
                        <p className="text-xs font-black uppercase tracking-wider text-foreground">
                          Snake team split
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Simple alternating assignment
                        </p>
                      </div>
                      <div className="border-b border-r border-border bg-[#162630] p-3 text-center">
                        <p className="text-xs font-black uppercase tracking-wider text-primary">
                          Optimized team split
                        </p>
                        <p className="mt-1 text-[11px] text-muted-foreground">
                          Best 5v5 MMR balance
                        </p>
                      </div>
                      {([
                        {
                          label: "Baseline",
                          ids: ["baseline-snake", "baseline-optimized"],
                        },
                        {
                          label: "Tail-aware",
                          ids: ["tail-snake", "tail-optimized"],
                        },
                      ] as Array<{ label: string; ids: AblationVariantId[] }>).flatMap(
                        (row) => [
                          <div
                            key={`${row.label}-label`}
                            className="flex items-center border-b border-r border-border bg-secondary/35 p-4"
                          >
                            <p className="text-sm font-black uppercase tracking-wide">
                              {row.label}
                            </p>
                          </div>,
                          ...row.ids.map((id) => {
                            const variant = ablation.variants[id];
                            const fullSystem = id === "tail-optimized";
                            return (
                              <div
                                key={id}
                                className={`border-b border-r p-4 ${
                                  fullSystem
                                    ? "bg-primary/10"
                                    : "bg-card/55"
                                }`}
                              >
                                <div className="flex items-center justify-between gap-3">
                                  <p className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                                    Bad matches
                                  </p>
                                  {fullSystem ? (
                                    <span className="border border-primary/40 bg-primary/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-primary">
                                      Full system
                                    </span>
                                  ) : null}
                                </div>
                                <p className={`display-type mt-2 text-3xl ${fullSystem ? "text-primary" : "text-foreground"}`}>
                                  {variant.badMatchRate.toFixed(1)}%
                                </p>
                                <div className="mt-3 grid grid-cols-3 gap-3 border-t border-border pt-3 text-xs">
                                  <div>
                                    <p className="uppercase text-muted-foreground">Spread</p>
                                    <p className="mt-1 font-mono font-bold">{Math.round(variant.spread)}</p>
                                  </div>
                                  <div>
                                    <p className="uppercase text-muted-foreground">Team gap</p>
                                    <p className="mt-1 font-mono font-bold">{variant.teamGap.toFixed(1)}</p>
                                  </div>
                                  <div>
                                    <p className="uppercase text-muted-foreground">Queue</p>
                                    <p className="mt-1 font-mono font-bold">{formatTime(variant.queueSeconds)}</p>
                                  </div>
                                </div>
                              </div>
                            );
                          }),
                        ],
                      )}
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 md:grid-cols-3">
                    {[
                      {
                        label: "Candidate selection effect",
                        value: ablation.effects.candidateSelectionWithSnake,
                        detail: "Tail-Aware vs. Baseline, both using the same snake team split.",
                      },
                      {
                        label: "Team balancing effect",
                        value: ablation.effects.teamBalancingWithBaseline,
                        detail: "Optimized vs. snake teams, both using Baseline candidates.",
                      },
                      {
                        label: "Full system effect",
                        value: ablation.effects.fullSystem,
                        detail: "Tail-Aware + Optimized compared with Baseline + Snake.",
                      },
                    ].map((effect) => (
                      <section key={effect.label} className="border border-border bg-secondary/25 p-4">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                          {effect.label}
                        </p>
                        <p className="display-type mt-2 text-2xl text-primary">
                          {effectLabel(effect.value)}
                        </p>
                        <p className="mt-2 text-xs leading-5 text-muted-foreground">
                          {effect.detail}
                        </p>
                      </section>
                    ))}
                  </div>

                  <div className="mt-3 border-l-2 border-primary bg-primary/5 px-4 py-3">
                    <p className="text-sm leading-6 text-foreground">
                      <span className="font-black uppercase text-primary">
                        What this run says:
                      </span>{" "}
                      Tail-Aware candidate selection accounts for{" "}
                      {effectLabel(
                        ablation.effects.candidateSelectionWithSnake,
                      )}{" "}
                      bad matches. Optimized team splitting changes the flagged
                      rate by{" "}
                      {Math.abs(
                        ablation.effects.teamBalancingWithBaseline,
                      ).toFixed(1)}{" "}
                      points, while reducing average team gap from{" "}
                      {ablation.variants["baseline-snake"].teamGap.toFixed(1)} to{" "}
                      {ablation.variants["baseline-optimized"].teamGap.toFixed(1)}{" "}
                      MMR.
                    </p>
                  </div>
                </div>
              )}
            </article>

            <article className="mt-5 border border-border bg-card/90">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-[#111f29] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center border border-primary/40 bg-primary/10 text-primary">
                    <Activity className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                      Metric stress test
                    </p>
                    <h3 className="display-type mt-1 text-2xl">
                      DEFINITION SENSITIVITY
                    </h3>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={runSensitivity}
                  disabled={sensitivityRunning}
                  className="cut-corners h-11 rounded-none bg-primary px-5 font-black uppercase tracking-[0.1em] text-primary-foreground hover:bg-primary/90"
                >
                  {sensitivityRunning ? (
                    <RefreshCw className="animate-spin" />
                  ) : (
                    <Play className="fill-current" />
                  )}
                  {sensitivityRunning
                    ? "Testing 16 definitions"
                    : sensitivity
                      ? "Rerun sensitivity test"
                      : "Test 16 definitions"}
                </Button>
              </div>

              {!sensitivity ? (
                <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <p className="max-w-3xl text-base leading-7 text-foreground">
                      Check whether Tail-Aware only looks better because we chose
                      one convenient definition of a bad match.
                    </p>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                      The test combines four lobby-spread limits with four
                      team-gap limits. A match is flagged when it crosses either
                      limit.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 border border-border bg-secondary/30">
                    <div className="border-r border-border px-5 py-4 text-center">
                      <p className="display-type text-3xl text-primary">16</p>
                      <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                        Definitions
                      </p>
                    </div>
                    <div className="px-5 py-4 text-center">
                      <p className="display-type text-3xl text-primary">
                        {(SENSITIVITY_RUNS * SENSITIVITY_MATCHES_PER_RUN * 4).toLocaleString()}
                      </p>
                      <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                        Matches
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-2 border-b border-border lg:grid-cols-4">
                    {[
                      {
                        label: "Definitions won",
                        value: `${sensitivity.wins} / ${sensitivity.cells.length}`,
                        note: "Full system lowers the flagged rate",
                      },
                      {
                        label: "Improvement range",
                        value: `${sensitivity.minReduction.toFixed(1)}–${sensitivity.maxReduction.toFixed(1)}`,
                        note: "percentage-point reduction",
                      },
                      {
                        label: "Team split matters",
                        value: `${sensitivity.balancingMatters} / ${sensitivity.cells.length}`,
                        note: "definitions with >0.5-point effect",
                      },
                      {
                        label: "Current definition",
                        value: `-${sensitivity.currentDefinition.reduction.toFixed(1)}`,
                        note: `${BAD_SPREAD_THRESHOLD} spread / ${BAD_TEAM_GAP_THRESHOLD} team gap`,
                      },
                    ].map((summary, index) => (
                      <section
                        key={summary.label}
                        className={`metric-grid p-4 ${
                          index % 2 ? "border-l border-border" : ""
                        } ${index > 1 ? "border-t border-border lg:border-t-0" : ""} ${
                          index > 0 ? "lg:border-l lg:border-border" : ""
                        }`}
                      >
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                          {summary.label}
                        </p>
                        <p className="display-type mt-2 text-3xl text-foreground">
                          {summary.value}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {summary.note}
                        </p>
                      </section>
                    ))}
                  </div>

                  <div className="p-5">
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                          Bad-match definition matrix
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Each cell shows Baseline + Snake → Tail-Aware + Optimized.
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {sensitivity.runs} runs × {sensitivity.matchesPerRun} matches per system ·{" "}
                        {sensitivity.scenario.population}% · {titleCase(sensitivity.scenario.traffic)}
                      </p>
                    </div>

                    <div className="overflow-x-auto">
                      <div className="grid min-w-[760px] grid-cols-[150px_repeat(4,minmax(140px,1fr))] border-l border-t border-border">
                        <div className="border-b border-r border-border bg-[#162630] p-3 text-xs font-black uppercase tracking-wider text-muted-foreground">
                          Team-gap limit ↓
                        </div>
                        {SENSITIVITY_SPREAD_THRESHOLDS.map((spreadThreshold) => (
                          <div
                            key={spreadThreshold}
                            className="border-b border-r border-border bg-[#162630] p-3 text-center"
                          >
                            <p className="text-xs font-black uppercase tracking-wider text-foreground">
                              {spreadThreshold} MMR
                            </p>
                            <p className="mt-1 text-[10px] uppercase text-muted-foreground">
                              Lobby spread
                            </p>
                          </div>
                        ))}
                        {SENSITIVITY_TEAM_GAP_THRESHOLDS.flatMap((teamGapThreshold) => [
                          <div
                            key={`${teamGapThreshold}-label`}
                            className="flex items-center border-b border-r border-border bg-secondary/35 p-3"
                          >
                            <div>
                              <p className="text-sm font-black uppercase">
                                {teamGapThreshold} MMR
                              </p>
                              <p className="mt-1 text-[10px] uppercase text-muted-foreground">
                                Team gap
                              </p>
                            </div>
                          </div>,
                          ...SENSITIVITY_SPREAD_THRESHOLDS.map((spreadThreshold) => {
                            const cell = sensitivity.cells.find(
                              (item) =>
                                item.spreadThreshold === spreadThreshold &&
                                item.teamGapThreshold === teamGapThreshold,
                            );
                            if (!cell) return null;
                            const current =
                              spreadThreshold === BAD_SPREAD_THRESHOLD &&
                              teamGapThreshold === BAD_TEAM_GAP_THRESHOLD;
                            return (
                              <div
                                key={`${teamGapThreshold}-${spreadThreshold}`}
                                className={`relative border-b border-r p-3 text-center ${reductionTone(
                                  cell.reduction,
                                )} ${
                                  current
                                    ? "outline outline-2 -outline-offset-2 outline-primary"
                                    : ""
                                }`}
                              >
                                {current ? (
                                  <span className="absolute right-1.5 top-1.5 text-[9px] font-black uppercase tracking-wider text-primary">
                                    Current
                                  </span>
                                ) : null}
                                <p className="mt-2 font-mono text-sm font-black">
                                  {cell.baselineRate.toFixed(0)}% → {cell.adaptiveRate.toFixed(0)}%
                                </p>
                                <p className="mt-1 text-[10px] font-black uppercase tracking-wider opacity-85">
                                  -{cell.reduction.toFixed(1)} points
                                </p>
                              </div>
                            );
                          }),
                        ])}
                      </div>
                    </div>

                    <div className="mt-4 border-l-2 border-primary bg-primary/5 px-4 py-3">
                      <p className="text-sm leading-6 text-foreground">
                        <span className="font-black uppercase text-primary">
                          What this run says:
                        </span>{" "}
                        Tail-Aware improves the result under {sensitivity.wins} of{" "}
                        {sensitivity.cells.length} tested definitions. Optimized team
                        balancing matters under {sensitivity.balancingMatters} of them,
                        especially when the allowed team gap is stricter than the
                        current {BAD_TEAM_GAP_THRESHOLD} MMR limit.
                      </p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        This shows robustness inside the simulation. It does not
                        prove that any threshold matches Riot&apos;s real definition
                        of match quality.
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </article>

            <article className="mt-5 border border-border bg-card/90">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-[#111f29] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center border border-primary/40 bg-primary/10 text-primary">
                    <BarChart3 className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                      Policy optimization
                    </p>
                    <h3 className="display-type mt-1 text-2xl">
                      PARETO FRONTIER
                    </h3>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={runPareto}
                  disabled={paretoRunning}
                  className="cut-corners h-11 rounded-none bg-primary px-5 font-black uppercase tracking-[0.1em] text-primary-foreground hover:bg-primary/90"
                >
                  {paretoRunning ? (
                    <RefreshCw className="animate-spin" />
                  ) : (
                    <Play className="fill-current" />
                  )}
                  {paretoRunning
                    ? "Finding efficient settings"
                    : pareto
                      ? "Recalculate frontier"
                      : "Find efficient settings"}
                </Button>
              </div>

              {!pareto ? (
                <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <p className="max-w-3xl text-base leading-7 text-foreground">
                      Find the settings that give the best possible match quality
                      for each queue-time cost.
                    </p>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                      Seven Tail-Aware search widths and the baseline receive the
                      same players. A setting is efficient when no other tested
                      setting is both faster and higher quality.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 border border-border bg-secondary/30">
                    <div className="border-r border-border px-5 py-4 text-center">
                      <p className="display-type text-3xl text-primary">8</p>
                      <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                        Settings
                      </p>
                    </div>
                    <div className="px-5 py-4 text-center">
                      <p className="display-type text-3xl text-primary">
                        {(PARETO_RUNS * PARETO_MATCHES_PER_RUN * 8).toLocaleString()}
                      </p>
                      <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                        Matches
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-2 border-b border-border lg:grid-cols-4">
                    {[
                      {
                        label: "Settings tested",
                        value: `${pareto.points.length}`,
                        note: `${pareto.runs} runs × ${pareto.matchesPerRun} matches`,
                      },
                      {
                        label: "Efficient frontier",
                        value: `${pareto.frontier.length} / ${pareto.points.length}`,
                        note: "not worse on both objectives",
                      },
                      {
                        label: "Best balance",
                        value: pareto.recommended.label,
                        note: "closest point to fast + high quality",
                      },
                      {
                        label: "Knee result",
                        value: `${formatTime(pareto.recommended.queueSeconds)} / ${pareto.recommended.badMatchRate.toFixed(1)}%`,
                        note: "median queue / bad matches",
                      },
                    ].map((summary, index) => (
                      <section
                        key={summary.label}
                        className={`metric-grid p-4 ${
                          index % 2 ? "border-l border-border" : ""
                        } ${index > 1 ? "border-t border-border lg:border-t-0" : ""} ${
                          index > 0 ? "lg:border-l lg:border-border" : ""
                        }`}
                      >
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                          {summary.label}
                        </p>
                        <p className="display-type mt-2 text-2xl text-foreground">
                          {summary.value}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {summary.note}
                        </p>
                      </section>
                    ))}
                  </div>

                  <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,.65fr)]">
                    <div>
                      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                            Quality–wait curve
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Lower and farther left is better. Gold marks the knee.
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {pareto.scenario.population}% · {titleCase(pareto.scenario.traffic)} ·{" "}
                          {pareto.scenario.policy === "integrity"
                            ? "Competitive"
                            : titleCase(pareto.scenario.policy)}
                        </p>
                      </div>
                      <ParetoChart study={pareto} />
                    </div>

                    <div className="border border-border bg-secondary/20">
                      <div className="border-b border-border bg-[#162630] px-4 py-3">
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                          Tested settings
                        </p>
                      </div>
                      <div className="divide-y divide-border">
                        {pareto.points.map((point) => (
                          <div
                            key={point.id}
                            className={`grid grid-cols-[minmax(0,1fr)_auto] gap-3 px-4 py-3 ${
                              point.id === pareto.recommended.id
                                ? "bg-[#3d351c]"
                                : ""
                            }`}
                          >
                            <div>
                              <div className="flex flex-wrap items-center gap-2">
                                <p className="text-sm font-black uppercase">
                                  {point.label}
                                </p>
                                {point.id === pareto.recommended.id ? (
                                  <span className="border border-[#8c7432] bg-[#55461f] px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#f3d177]">
                                    Knee
                                  </span>
                                ) : null}
                                {point.baseline ? (
                                  <span className="border border-destructive/40 bg-destructive/10 px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider text-[#ff8792]">
                                    Control
                                  </span>
                                ) : null}
                              </div>
                              <p className="mt-1 text-[11px] text-muted-foreground">
                                {point.radiusScale === null
                                  ? "Original candidate selector"
                                  : `${Math.round(point.radiusScale * 100)}% search radius`}
                              </p>
                            </div>
                            <div className="text-right font-mono text-xs">
                              <p>{formatTime(point.queueSeconds)} queue</p>
                              <p className="mt-1 text-muted-foreground">
                                {point.badMatchRate.toFixed(1)}% bad
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {paretoBaseline && paretoBestQuality ? (
                    <div className="mx-5 mb-5 border-l-2 border-primary bg-primary/5 px-4 py-3">
                      <p className="text-sm leading-6 text-foreground">
                        <span className="font-black uppercase text-primary">
                          What this run says:
                        </span>{" "}
                        The {pareto.recommended.label} setting cuts bad matches from{" "}
                        {paretoBaseline.badMatchRate.toFixed(1)}% to{" "}
                        {pareto.recommended.badMatchRate.toFixed(1)}% for{" "}
                        {Math.max(
                          0,
                          pareto.recommended.queueSeconds - paretoBaseline.queueSeconds,
                        ).toFixed(1)}{" "}
                        additional median seconds. Pushing to {paretoBestQuality.label}
                        reaches {paretoBestQuality.badMatchRate.toFixed(1)}%, but costs{" "}
                        {Math.max(
                          0,
                          paretoBestQuality.queueSeconds - pareto.recommended.queueSeconds,
                        ).toFixed(1)}{" "}
                        more seconds beyond the knee.
                      </p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        The gold recommendation minimizes normalized distance to
                        the fastest queue and lowest bad-match rate among tested
                        settings. It is a simulated policy choice, not a universal
                        optimum.
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </article>

            <article className="mt-5 border border-border bg-card/90">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-[#111f29] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center border border-primary/40 bg-primary/10 text-primary">
                    <Cpu className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                      Exact-solver benchmark
                    </p>
                    <h3 className="display-type mt-1 text-2xl">
                      HEURISTIC VS. ORACLE
                    </h3>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={runOracle}
                  disabled={oracleRunning}
                  className="cut-corners h-11 rounded-none bg-primary px-5 font-black uppercase tracking-[0.1em] text-primary-foreground hover:bg-primary/90"
                >
                  {oracleRunning ? (
                    <RefreshCw className="animate-spin" />
                  ) : (
                    <Play className="fill-current" />
                  )}
                  {oracleRunning
                    ? "Checking every layout"
                    : oracle
                      ? "Rerun oracle benchmark"
                      : "Run oracle benchmark"}
                </Button>
              </div>

              {!oracle ? (
                <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <p className="max-w-3xl text-base leading-7 text-foreground">
                      Measure how close the fast matchers get to the mathematically
                      best match available in small queue snapshots.
                    </p>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                      For each {ORACLE_POOL_SIZE}-player queue, the oracle checks all
                      10-player lobbies and every unique 5v5 split. Lower objective
                      cost is better.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 border border-border bg-secondary/30">
                    <div className="border-r border-border px-5 py-4 text-center">
                      <p className="display-type text-3xl text-primary">
                        {ORACLE_SNAPSHOTS}
                      </p>
                      <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                        Snapshots
                      </p>
                    </div>
                    <div className="px-5 py-4 text-center">
                      <p className="display-type text-3xl text-primary">2.5M</p>
                      <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                        Team layouts
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-2 border-b border-border lg:grid-cols-4">
                    {[
                      {
                        label: "Tail-Aware quality",
                        value: `${oracle.tailQualityAchieved.toFixed(1)}%`,
                        note: "of exact-oracle objective quality",
                      },
                      {
                        label: "Exact optimum found",
                        value: `${oracle.tailExactHits} / ${oracle.snapshots.length}`,
                        note: "Tail-Aware matched oracle cost",
                      },
                      {
                        label: "Beats baseline",
                        value: `${oracle.tailBeatsBaseline} / ${oracle.snapshots.length}`,
                        note: "lower objective cost",
                      },
                      {
                        label: "Oracle slowdown",
                        value: `${oracle.oracleSlowdown.toFixed(0)}×`,
                        note: "versus Tail-Aware runtime",
                      },
                    ].map((summary, index) => (
                      <section
                        key={summary.label}
                        className={`metric-grid p-4 ${
                          index % 2 ? "border-l border-border" : ""
                        } ${index > 1 ? "border-t border-border lg:border-t-0" : ""} ${
                          index > 0 ? "lg:border-l lg:border-border" : ""
                        }`}
                      >
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                          {summary.label}
                        </p>
                        <p className="display-type mt-2 text-3xl text-foreground">
                          {summary.value}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {summary.note}
                        </p>
                      </section>
                    ))}
                  </div>

                  <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1fr)_minmax(360px,.8fr)]">
                    <div className="border border-border bg-secondary/20 p-5">
                      <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                            Objective quality achieved
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Oracle is the 100% reference. Higher is better.
                          </p>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {oracle.scenario.population}% · {titleCase(oracle.scenario.traffic)} ·{" "}
                          {oracle.scenario.policy === "integrity"
                            ? "Competitive"
                            : titleCase(oracle.scenario.policy)}
                        </p>
                      </div>
                      <div className="space-y-5">
                        {[
                          {
                            label: "Exact oracle",
                            value: 100,
                            color: "bg-[#f3d177]",
                          },
                          {
                            label: "Tail-Aware",
                            value: oracle.tailQualityAchieved,
                            color: "bg-primary",
                          },
                          {
                            label: "Baseline",
                            value: oracle.baselineQualityAchieved,
                            color: "bg-destructive",
                          },
                        ].map((row) => (
                          <div key={row.label}>
                            <div className="mb-1.5 flex justify-between text-xs font-black uppercase tracking-wider">
                              <span>{row.label}</span>
                              <span>{row.value.toFixed(1)}%</span>
                            </div>
                            <div className="h-3 bg-[#10212a]">
                              <div
                                className={`h-full ${row.color}`}
                                style={{ width: `${Math.max(1, row.value)}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-6 border-t border-border pt-5">
                        <p className="mb-4 text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                          Average decision runtime
                        </p>
                        <div className="space-y-3">
                          {[
                            {
                              label: "Baseline",
                              value: oracle.averageRuntimeMs.baseline,
                              color: "bg-destructive",
                            },
                            {
                              label: "Tail-Aware",
                              value: oracle.averageRuntimeMs.tail,
                              color: "bg-primary",
                            },
                            {
                              label: "Exact oracle",
                              value: oracle.averageRuntimeMs.oracle,
                              color: "bg-[#f3d177]",
                            },
                          ].map((row) => (
                            <div
                              key={row.label}
                              className="grid grid-cols-[92px_minmax(0,1fr)_74px] items-center gap-3"
                            >
                              <p className="text-xs font-black uppercase">
                                {row.label}
                              </p>
                              <div className="h-2 bg-[#10212a]">
                                <div
                                  className={`h-full ${row.color}`}
                                  style={{
                                    width: `${Math.max(
                                      1,
                                      (row.value /
                                        Math.max(
                                          0.001,
                                          oracle.averageRuntimeMs.oracle,
                                        )) *
                                        100,
                                    )}%`,
                                  }}
                                />
                              </div>
                              <p className="text-right font-mono text-xs">
                                {formatRuntime(row.value)}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className="border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border bg-[#162630] hover:bg-[#162630]">
                            <TableHead className="px-3 text-xs font-black uppercase tracking-wider text-muted-foreground">
                              Queue
                            </TableHead>
                            <TableHead className="text-right text-xs font-black uppercase tracking-wider text-muted-foreground">
                              Baseline
                            </TableHead>
                            <TableHead className="text-right text-xs font-black uppercase tracking-wider text-muted-foreground">
                              Tail
                            </TableHead>
                            <TableHead className="text-right text-xs font-black uppercase tracking-wider text-muted-foreground">
                              Oracle
                            </TableHead>
                            <TableHead className="text-right text-xs font-black uppercase tracking-wider text-muted-foreground">
                              Gap
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {oracle.snapshots.slice(0, 10).map((snapshot) => {
                            const gap = Math.max(
                              0,
                              ((snapshot.tailCost - snapshot.oracleCost) /
                                Math.max(0.001, Math.abs(snapshot.oracleCost))) *
                                100,
                            );
                            return (
                              <TableRow
                                key={snapshot.snapshot}
                                className="border-border bg-card/50 hover:bg-secondary/35"
                              >
                                <TableCell className="px-3 font-mono text-xs">
                                  #{String(snapshot.snapshot).padStart(2, "0")}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                  {snapshot.baselineCost.toFixed(1)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-primary">
                                  {snapshot.tailCost.toFixed(1)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-[#f3d177]">
                                  {snapshot.oracleCost.toFixed(1)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                  {gap < 0.05 ? "Exact" : `+${gap.toFixed(1)}%`}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                      <p className="border-t border-border px-3 py-2 text-[11px] text-muted-foreground">
                        First 10 of {oracle.snapshots.length} queue snapshots · lower cost is better
                      </p>
                    </div>
                  </div>

                  <div className="mx-5 mb-5 border-l-2 border-primary bg-primary/5 px-4 py-3">
                    <p className="text-sm leading-6 text-foreground">
                      <span className="font-black uppercase text-primary">
                        What this run says:
                      </span>{" "}
                      Tail-Aware retained {oracle.tailQualityAchieved.toFixed(1)}%
                      of exact-oracle quality and found the exact answer in{" "}
                      {oracle.tailExactHits} of {oracle.snapshots.length} snapshots,
                      while the oracle took approximately {oracle.oracleSlowdown.toFixed(0)}×
                      longer per decision.
                    </p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">
                      The oracle minimizes the same synthetic objective used by
                      Tail-Aware: lobby spread + 3× team gap + high-rank mixing
                      penalty − a small wait credit. Runtime depends on the user&apos;s
                      device. “Optimal” only means best under this stated objective
                      within the {oracle.poolSize}-player snapshot.
                    </p>
                    <p className="mt-2 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                      {oracle.candidateLobbiesPerSnapshot.toLocaleString()} candidate
                      lobbies · {oracle.teamLayoutsPerSnapshot.toLocaleString()} team
                      layouts checked per snapshot
                    </p>
                  </div>
                </div>
              )}
            </article>

            <article className="mt-5 border border-border bg-card/90">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-[#111f29] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center border border-primary/40 bg-primary/10 text-primary">
                    <Gauge className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                      System stress test
                    </p>
                    <h3 className="display-type mt-1 text-2xl">
                      PERFORMANCE AT SCALE
                    </h3>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={runScale}
                  disabled={scaleRunning}
                  className="cut-corners h-11 rounded-none bg-primary px-5 font-black uppercase tracking-[0.1em] text-primary-foreground hover:bg-primary/90"
                >
                  {scaleRunning ? (
                    <RefreshCw className="animate-spin" />
                  ) : (
                    <Play className="fill-current" />
                  )}
                  {scaleRunning
                    ? "Scanning up to 50K"
                    : scale
                      ? "Rerun scale test"
                      : "Run scale test"}
                </Button>
              </div>

              {!scale ? (
                <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <p className="max-w-3xl text-base leading-7 text-foreground">
                      Increase the candidate pool from 50 to 50,000 players and
                      find where real-time matchmaking becomes too expensive.
                    </p>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                      Each size is warmed up, then timed {SCALE_ITERATIONS} times.
                      The median includes candidate selection, team assignment,
                      and objective scoring.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 border border-border bg-secondary/30">
                    <div className="border-r border-border px-5 py-4 text-center">
                      <p className="display-type text-3xl text-primary">
                        {SCALE_QUEUE_SIZES.length}
                      </p>
                      <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                        Queue sizes
                      </p>
                    </div>
                    <div className="px-5 py-4 text-center">
                      <p className="display-type text-3xl text-primary">
                        {SCALE_LATENCY_BUDGET_MS}MS
                      </p>
                      <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                        Decision budget
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-2 border-b border-border lg:grid-cols-4">
                    {[
                      {
                        label: "Largest tested",
                        value: compactCount(scaleLargest?.queueSize ?? 0),
                        note: "candidates in one decision",
                      },
                      {
                        label: "Within 50 ms",
                        value: compactCount(scale.maxWithinBudget),
                        note: "largest tested pool under budget",
                      },
                      {
                        label: "50K latency",
                        value: scaleLargest
                          ? formatRuntime(scaleLargest.tailRuntimeMs)
                          : "—",
                        note: "Tail-Aware median decision",
                      },
                      {
                        label: "50K throughput",
                        value: scaleLargest
                          ? `${scaleLargest.tailThroughput.toFixed(1)}/S`
                          : "—",
                        note: "single-thread decisions per second",
                      },
                    ].map((summary, index) => (
                      <section
                        key={summary.label}
                        className={`metric-grid p-4 ${
                          index % 2 ? "border-l border-border" : ""
                        } ${index > 1 ? "border-t border-border lg:border-t-0" : ""} ${
                          index > 0 ? "lg:border-l lg:border-border" : ""
                        }`}
                      >
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                          {summary.label}
                        </p>
                        <p className="display-type mt-2 text-3xl text-foreground">
                          {summary.value}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {summary.note}
                        </p>
                      </section>
                    ))}
                  </div>

                  <div className="grid gap-5 p-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(420px,.7fr)]">
                    <div>
                      <div className="mb-3 flex flex-wrap items-end justify-between gap-3">
                        <div>
                          <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                            Latency growth
                          </p>
                          <p className="mt-1 text-sm text-muted-foreground">
                            Median runtime across {scale.iterations} measured decisions.
                          </p>
                        </div>
                        <div className="flex gap-4 text-xs font-bold uppercase tracking-wider">
                          <span className="flex items-center gap-2 text-destructive">
                            <span className="size-2 bg-destructive" /> Baseline
                          </span>
                          <span className="flex items-center gap-2 text-primary">
                            <span className="size-2 bg-primary" /> Tail-Aware
                          </span>
                        </div>
                      </div>
                      <ScaleChart study={scale} />
                    </div>

                    <div className="overflow-x-auto border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border bg-[#162630] hover:bg-[#162630]">
                            <TableHead className="px-3 text-xs font-black uppercase tracking-wider text-muted-foreground">
                              Candidates
                            </TableHead>
                            <TableHead className="text-right text-xs font-black uppercase tracking-wider text-muted-foreground">
                              Baseline
                            </TableHead>
                            <TableHead className="text-right text-xs font-black uppercase tracking-wider text-muted-foreground">
                              Tail
                            </TableHead>
                            <TableHead className="text-right text-xs font-black uppercase tracking-wider text-muted-foreground">
                              Tail / sec
                            </TableHead>
                            <TableHead className="text-center text-xs font-black uppercase tracking-wider text-muted-foreground">
                              Budget
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {scale.rows.map((row) => {
                            const within =
                              row.tailRuntimeMs <= scale.latencyBudgetMs;
                            return (
                              <TableRow
                                key={row.queueSize}
                                className="border-border bg-card/50 hover:bg-secondary/35"
                              >
                                <TableCell className="px-3 font-mono text-xs font-bold">
                                  {row.queueSize.toLocaleString()}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                  {formatRuntime(row.baselineRuntimeMs)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs text-primary">
                                  {formatRuntime(row.tailRuntimeMs)}
                                </TableCell>
                                <TableCell className="text-right font-mono text-xs">
                                  {row.tailThroughput.toFixed(
                                    row.tailThroughput >= 100 ? 0 : 1,
                                  )}
                                </TableCell>
                                <TableCell className="text-center">
                                  <span
                                    className={`inline-flex border px-1.5 py-0.5 text-[9px] font-black uppercase tracking-wider ${
                                      within
                                        ? "border-primary/40 bg-primary/10 text-primary"
                                        : "border-destructive/40 bg-destructive/10 text-[#ff8792]"
                                    }`}
                                  >
                                    {within ? "Pass" : "Over"}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {scaleLargest ? (
                    <div className="mx-5 mb-5 border-l-2 border-primary bg-primary/5 px-4 py-3">
                      <p className="text-sm leading-6 text-foreground">
                        <span className="font-black uppercase text-primary">
                          What this run says:
                        </span>{" "}
                        Tail-Aware stays below the {scale.latencyBudgetMs} ms budget
                        through {scale.maxWithinBudget.toLocaleString()} candidates
                        {scaleFirstOverBudget
                          ? ` and first crosses it at ${scaleFirstOverBudget.queueSize.toLocaleString()}, where the median decision takes ${formatRuntime(scaleFirstOverBudget.tailRuntimeMs)}.`
                          : "."}{" "}
                        At the large end, observed growth is approximately n
                        <sup>{scale.tailGrowthExponent.toFixed(2)}</sup>, close to
                        linear scanning behavior.
                      </p>
                      <p className="mt-2 text-xs leading-5 text-muted-foreground">
                        Tail-Aware produced a lower objective cost at{" "}
                        {scale.qualityWins} of {scale.rows.length} tested sizes.
                        Timings are local and device-dependent. A production system
                        would also partition candidates by region, latency, rank,
                        and party constraints instead of scanning an entire global
                        queue.
                      </p>
                    </div>
                  ) : null}
                </div>
              )}
            </article>

            <article className="mt-5 border border-border bg-card/90">
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-border bg-[#111f29] px-5 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center border border-primary/40 bg-primary/10 text-primary">
                    <Grid3X3 className="size-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">
                      Population stress test
                    </p>
                    <h3 className="display-type mt-1 text-2xl">
                      36-SCENARIO SWEEP
                    </h3>
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={runSweep}
                  disabled={sweepRunning}
                  className="cut-corners h-11 rounded-none bg-primary px-5 font-black uppercase tracking-[0.1em] text-primary-foreground hover:bg-primary/90"
                >
                  {sweepRunning ? (
                    <RefreshCw className="animate-spin" />
                  ) : (
                    <Play className="fill-current" />
                  )}
                  {sweepRunning
                    ? "Testing every scenario"
                    : sweep
                      ? "Rerun all scenarios"
                      : "Run all scenarios"}
                </Button>
              </div>

              {!sweep ? (
                <div className="grid gap-5 p-5 lg:grid-cols-[1fr_auto] lg:items-center">
                  <div>
                    <p className="max-w-3xl text-base leading-7 text-foreground">
                      Test every combination of four population levels, three
                      traffic periods, and three queue policies automatically.
                    </p>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
                      Each scenario runs {SWEEP_RUNS} independent trials ×{" "}
                      {SWEEP_MATCHES_PER_RUN} matches for both algorithms. A queue
                      is classified as collapsed when at least{" "}
                      {COLLAPSE_BAD_MATCH_RATE}% of its matches cross the bad-match
                      threshold.
                    </p>
                  </div>
                  <div className="grid grid-cols-3 border border-border bg-secondary/30">
                    <div className="border-r border-border p-4 text-center">
                      <p className="display-type text-3xl text-primary">4</p>
                      <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                        Populations
                      </p>
                    </div>
                    <div className="border-r border-border p-4 text-center">
                      <p className="display-type text-3xl text-primary">3</p>
                      <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                        Periods
                      </p>
                    </div>
                    <div className="p-4 text-center">
                      <p className="display-type text-3xl text-primary">3</p>
                      <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">
                        Policies
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className="grid grid-cols-2 border-b border-border lg:grid-cols-4">
                    {[
                      {
                        label: "Scenarios tested",
                        value: `${sweep.rows.length}`,
                        note: `${(
                          sweep.rows.length *
                          sweep.runsPerScenario *
                          sweep.matchesPerRun *
                          2
                        ).toLocaleString()} total matches`,
                      },
                      {
                        label: "Baseline collapses",
                        value: `${sweep.baselineCollapses}`,
                        note: `of ${sweep.rows.length} scenarios`,
                      },
                      {
                        label: "Tail-aware collapses",
                        value: `${sweep.adaptiveCollapses}`,
                        note: `${Math.max(
                          0,
                          sweep.baselineCollapses - sweep.adaptiveCollapses,
                        )} collapses prevented`,
                      },
                      {
                        label: "Quality wins",
                        value: `${sweep.qualityWins}`,
                        note: "lower bad-match rate",
                      },
                    ].map((summary, index) => (
                      <section
                        key={summary.label}
                        className={`metric-grid p-4 ${
                          index % 2 ? "border-l border-border" : ""
                        } ${index > 1 ? "border-t border-border lg:border-t-0" : ""} ${
                          index > 0 ? "lg:border-l lg:border-border" : ""
                        }`}
                      >
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                          {summary.label}
                        </p>
                        <p className="display-type mt-2 text-3xl text-foreground">
                          {summary.value}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {summary.note}
                        </p>
                      </section>
                    ))}
                  </div>

                  <div className="p-5">
                    <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                      <div>
                        <p className="text-xs font-black uppercase tracking-[0.14em] text-muted-foreground">
                          Collapse matrix
                        </p>
                        <p className="mt-1 text-sm text-muted-foreground">
                          Each cell shows Baseline → Tail-Aware bad-match rate.
                        </p>
                      </div>
                      <div
                        className="flex flex-wrap gap-2"
                        role="group"
                        aria-label="Sweep policy filter"
                      >
                        {SWEEP_POLICIES.map((value) => (
                          <Button
                            key={value}
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => setSweepPolicy(value)}
                            aria-pressed={sweepPolicy === value}
                            className={`rounded-none uppercase ${
                              sweepPolicy === value
                                ? "border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                                : "border-border bg-secondary/30 text-muted-foreground"
                            }`}
                          >
                            {value === "integrity"
                              ? "Competitive"
                              : titleCase(value)}
                          </Button>
                        ))}
                      </div>
                    </div>

                    <div className="overflow-x-auto">
                      <div className="grid min-w-[680px] grid-cols-[130px_repeat(4,minmax(120px,1fr))] border-l border-t border-border">
                        <div className="border-b border-r border-border bg-[#162630] p-3 text-xs font-black uppercase tracking-wider text-muted-foreground">
                          Traffic
                        </div>
                        {SWEEP_POPULATIONS.map((value) => (
                          <div
                            key={value}
                            className="border-b border-r border-border bg-[#162630] p-3 text-center text-xs font-black uppercase tracking-wider text-muted-foreground"
                          >
                            {value}% population
                          </div>
                        ))}
                        {SWEEP_TRAFFIC.flatMap((trafficValue) => [
                          <div
                            key={`${trafficValue}-label`}
                            className="flex items-center border-b border-r border-border bg-secondary/35 p-3 text-sm font-black uppercase"
                          >
                            {titleCase(trafficValue)}
                          </div>,
                          ...SWEEP_POPULATIONS.map((populationValue) => {
                            const row = visibleSweepRows.find(
                              (item) =>
                                item.traffic === trafficValue &&
                                item.population === populationValue,
                            );
                            if (!row) return null;
                            return (
                              <div
                                key={`${trafficValue}-${populationValue}`}
                                className={`border-b border-r p-3 text-center ${rateTone(
                                  row.adaptive.badMatchRate,
                                )}`}
                              >
                                <p className="font-mono text-base font-black">
                                  {row.baseline.badMatchRate.toFixed(0)}%{" "}
                                  <span className="opacity-50">→</span>{" "}
                                  {row.adaptive.badMatchRate.toFixed(0)}%
                                </p>
                                <p className="mt-1 text-[10px] font-black uppercase tracking-wider opacity-80">
                                  {sweepVerdict(row)}
                                </p>
                              </div>
                            );
                          }),
                        ])}
                      </div>
                    </div>

                    <div className="mt-5 border border-border">
                      <Table>
                        <TableHeader>
                          <TableRow className="border-border bg-[#162630] hover:bg-[#162630]">
                            <TableHead className="px-4 text-xs font-black uppercase tracking-wider text-muted-foreground">
                              Scenario
                            </TableHead>
                            <TableHead className="text-right text-xs font-black uppercase tracking-wider text-muted-foreground">
                              Baseline
                            </TableHead>
                            <TableHead className="text-right text-xs font-black uppercase tracking-wider text-muted-foreground">
                              Tail-aware
                            </TableHead>
                            <TableHead className="text-right text-xs font-black uppercase tracking-wider text-muted-foreground">
                              Tradeoff
                            </TableHead>
                            <TableHead className="text-center text-xs font-black uppercase tracking-wider text-muted-foreground">
                              Result
                            </TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {visibleSweepRows.map((row) => {
                            const verdict = sweepVerdict(row);
                            return (
                              <TableRow
                                key={`${row.traffic}-${row.population}`}
                                className="border-border bg-card/50 hover:bg-secondary/35"
                              >
                                <TableCell className="px-4 py-3">
                                  <p className="font-black uppercase">
                                    {titleCase(row.traffic)} · {row.population}%
                                  </p>
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {Math.round(row.baseline.spread)} →{" "}
                                    {Math.round(row.adaptive.spread)} MMR spread
                                  </p>
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  <p>{row.baseline.badMatchRate.toFixed(1)}% bad</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatTime(row.baseline.queueSeconds)} queue
                                  </p>
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  <p>{row.adaptive.badMatchRate.toFixed(1)}% bad</p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatTime(row.adaptive.queueSeconds)} queue
                                  </p>
                                </TableCell>
                                <TableCell className="text-right font-mono">
                                  <p className="text-primary">
                                    {row.badMatchReduction >= 0 ? "-" : "+"}
                                    {Math.abs(row.badMatchReduction).toFixed(1)} pts
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {row.extraWait >= 0 ? "+" : ""}
                                    {row.extraWait.toFixed(0)} sec
                                  </p>
                                </TableCell>
                                <TableCell className="text-center">
                                  <span
                                    className={`inline-flex border px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                                      verdict === "Recovered"
                                        ? "border-primary/50 bg-primary/10 text-primary"
                                        : verdict === "Collapsed"
                                          ? "border-destructive/50 bg-destructive/10 text-[#ff8792]"
                                          : "border-border bg-secondary text-muted-foreground"
                                    }`}
                                  >
                                    {verdict}
                                  </span>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>

                    <p className="mt-4 text-sm leading-6 text-muted-foreground">
                      Largest observed improvement:{" "}
                      <span className="font-bold text-foreground">
                        {sweep.biggestReduction.population}% population ·{" "}
                        {titleCase(sweep.biggestReduction.traffic)} ·{" "}
                        {sweep.biggestReduction.policy === "integrity"
                          ? "Competitive"
                          : titleCase(sweep.biggestReduction.policy)}
                      </span>
                      , reducing bad matches by{" "}
                      {sweep.biggestReduction.badMatchReduction.toFixed(1)}
                      percentage points for{" "}
                      {Math.abs(sweep.biggestReduction.extraWait).toFixed(0)}{" "}
                      {sweep.biggestReduction.extraWait >= 0
                        ? "additional"
                        : "fewer"}{" "}
                      seconds.
                    </p>
                  </div>
                </div>
              )}
            </article>

              </>
            ) : null}

            <p className="mt-4 text-xs leading-5 text-muted-foreground">
              Results use synthetic player arrivals and MMR assumptions. RiftQueue is
              not affiliated with Riot Games and does not use Riot&apos;s private systems.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}
