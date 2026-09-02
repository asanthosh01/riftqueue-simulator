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
    sortedPlayers.              <span>5 vs 5 · same simulated match</span>
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
                <div className="flex items-ce What this run says:
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
                        <p className="text-xs font-black uppercase t