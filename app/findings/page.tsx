import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Clock3,
  Scale,
  ShieldAlert,
  Split,
} from "lucide-react";

import validationArtifact from "@/docs/results/official-benchmark-validation.json";

export const metadata: Metadata = {
  title: "Findings — RiftQueue",
  description:
    "Synthetic benchmark findings for RiftQueue's high-ELO matchmaking simulation.",
};

type Metric = {
  mean: number;
  confidence: { low: number; high: number };
};

type Arm = {
  id: string;
  population: number;
  traffic: string;
  policy: string;
  pairedDifferences: Record<string, Metric>;
  trials: Array<{
    baseline: { badMatchRate: number };
    adaptive: { badMatchRate: number };
  }>;
};

const report = validationArtifact as {
  runsPerArm: number;
  matchesPerRun: number;
  officialArms: Arm[];
  lateNightBalancedAblation: {
    contrasts: Record<string, { pairedDifferences: Record<string, Metric> }>;
  };
  lateNightBalancedSensitivity: { cells: unknown[] };
};

const labels: Record<string, string> = {
  fast: "Fast Queue",
  balanced: "Balanced",
  integrity: "Competitive",
};

function arm(id: string) {
  const selected = report.officialArms.find((item) => item.id === id);
  if (!selected) throw new Error(`Missing official benchmark arm: ${id}`);
  return selected;
}

function signed(value: number, precision = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(precision)}`;
}

function interval(metric: Metric) {
  return `${signed(metric.confidence.low)} to ${signed(metric.confidence.high)}`;
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

const configurationIds = [
  "peak-balanced",
  "late-policy-tradeoff-fast",
  "late-balanced",
  "late-policy-tradeoff-integrity",
  "overnight-balanced",
];
const configurations = configurationIds.map(arm);
const lateBalanced = arm("late-balanced");
const overnight = arm("overnight-balanced");
const lateMetrics = lateBalanced.pairedDifferences;
const ablation = report.lateNightBalancedAblation.contrasts;
const candidateSelection = ablation.candidateSelectionWithSnake.pairedDifferences;
const baselineBalancing = ablation.teamBalancingWithBaseline.pairedDifferences;
const tailAwareBalancing = ablation.teamBalancingWithTailAware.pairedDifferences;
const overnightBadRate = overnight.pairedDifferences.badMatchRate;
const overnightBaselineBadRate = average(overnight.trials.map((trial) => trial.baseline.badMatchRate));
const overnightTailAwareBadRate = average(overnight.trials.map((trial) => trial.adaptive.badMatchRate));

const lateEffectRows = [
  { label: "Median queue time", metric: lateMetrics.queueSeconds, unit: "seconds", direction: "longer wait" },
  { label: "Lobby spread", metric: lateMetrics.spread, unit: "synthetic MMR", direction: "tighter lobby" },
  { label: "Team gap", metric: lateMetrics.teamGap, unit: "synthetic MMR", direction: "more even teams" },
  { label: "Bad-match rate", metric: lateMetrics.badMatchRate, unit: "percentage points", direction: "fewer flagged matches" },
];

export default function FindingsPage() {
  return (
    <main className="min-h-screen px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
      <div className="mx-auto max-w-[1250px]">
        <section className="border border-primary/40 bg-[linear-gradient(135deg,rgba(34,231,192,.14),rgba(8,20,27,.98)_48%,rgba(243,209,119,.09))] p-6 sm:p-8 lg:p-10">
          <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.14em]">
            <span className="border border-primary/40 bg-primary/10 px-3 py-1.5 text-primary">Synthetic benchmark findings</span>
            <span className="border border-border bg-secondary/30 px-3 py-1.5 text-muted-foreground">{report.runsPerArm} locked trials per configuration</span>
          </div>
          <div className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_.9fr] lg:items-end">
            <div>
              <h1 className="display-type max-w-3xl text-4xl leading-[1.02] sm:text-5xl lg:text-6xl">FINDINGS: THE TRADEOFF IS REAL, IN THE MODEL</h1>
              <p className="mt-5 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                In RiftQueue&apos;s fixed, synthetic tests, Tail-Aware usually waits longer to make tighter lobbies.
                The strongest tradeoff appears late at night, when the model has fewer players to work with.
              </p>
            </div>
            <aside className="border border-primary/35 bg-[#071219]/85 p-5">
              <p className="text-xs font-black uppercase tracking-[0.14em] text-primary">Read this first</p>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                These are synthetic simulation results, not measurements of Riot Games or its production
                matchmaking. The confidence ranges show variation across repeated model runs, not accuracy
                against a live game.
              </p>
            </aside>
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <article className="border border-border bg-card/90 p-5 sm:p-6">
            <div className="flex items-center gap-3 text-primary">
              <Clock3 className="size-5" />
              <p className="text-xs font-black uppercase tracking-[0.15em]">Late-night / Balanced</p>
            </div>
            <p className="display-type mt-5 text-5xl text-primary">{signed(lateMetrics.queueSeconds.mean)} SEC</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              median queue time for Tail-Aware versus Baseline ({interval(lateMetrics.queueSeconds)} seconds)
            </p>
          </article>
          <article className="border border-primary/40 bg-primary/10 p-5 sm:p-6">
            <div className="flex items-center gap-3 text-primary">
              <ShieldAlert className="size-5" />
              <p className="text-xs font-black uppercase tracking-[0.15em]">Late-night / Balanced</p>
            </div>
            <p className="display-type mt-5 text-5xl text-primary">{signed(lateMetrics.badMatchRate.mean)} PP</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              default bad-match rate for Tail-Aware versus Baseline ({interval(lateMetrics.badMatchRate)} percentage points)
            </p>
          </article>
        </section>

        <section className="mt-6 border border-border bg-card/90">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-border bg-[#111f29] px-5 py-4 sm:px-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">Five unique configurations</p>
              <h2 className="display-type mt-1 text-2xl sm:text-3xl">ONE COMPARISON, FIVE CONDITIONS</h2>
            </div>
            <p className="max-w-md text-xs leading-5 text-muted-foreground">
              Every number is Tail-Aware minus Baseline. Positive queue time means a longer wait; negative quality values mean a lower value.
            </p>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-[850px] w-full text-left text-sm">
              <thead className="border-b border-border text-[11px] font-black uppercase tracking-[0.11em] text-muted-foreground">
                <tr>
                  <th className="px-5 py-4 sm:px-6">Configuration</th>
                  <th className="px-4 py-4">Queue</th>
                  <th className="px-4 py-4">Lobby spread</th>
                  <th className="px-4 py-4">Team gap</th>
                  <th className="px-4 py-4">Bad-match rate</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {configurations.map((configuration) => {
                  const differences = configuration.pairedDifferences;
                  return (
                    <tr key={configuration.id} className="bg-card/40 transition-colors hover:bg-secondary/20">
                      <td className="px-5 py-4 sm:px-6">
                        <p className="font-black uppercase tracking-[0.08em]">{configuration.traffic === "late" ? "Late-night" : configuration.traffic === "peak" ? "Peak" : "Overnight"} / {labels[configuration.policy]}</p>
                        <p className="mt-1 text-xs text-muted-foreground">{configuration.population}% population · {configuration.traffic} traffic</p>
                      </td>
                      <td className="px-4 py-4 font-mono text-primary">{signed(differences.queueSeconds.mean)} sec</td>
                      <td className="px-4 py-4 font-mono">{signed(differences.spread.mean)}</td>
                      <td className="px-4 py-4 font-mono">{signed(differences.teamGap.mean)}</td>
                      <td className="px-4 py-4 font-mono">{signed(differences.badMatchRate.mean)} pp</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-5 py-3 text-xs leading-5 text-muted-foreground sm:px-6">
            The official report has six arms, but Late-night / Balanced appears twice: once as its own scenario and once within the policy comparison. It is shown once here.
          </p>
        </section>

        <section className="mt-6 border border-border bg-card/90">
          <div className="border-b border-border bg-[#111f29] px-5 py-4 sm:px-6">
            <p className="text-xs font-black uppercase tracking-[0.16em] text-primary">The late-night tradeoff</p>
            <h2 className="display-type mt-1 text-2xl sm:text-3xl">WHAT CHANGED, AND HOW CONSISTENTLY?</h2>
          </div>
          <div className="grid divide-y divide-border md:grid-cols-2 md:divide-x md:divide-y-0">
            {lateEffectRows.map((row) => (
              <article key={row.label} className="p-5 sm:p-6">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-[0.12em] text-muted-foreground">{row.label}</p>
                    <p className="display-type mt-3 text-3xl text-primary">{signed(row.metric.mean)} {row.unit === "percentage points" ? "PP" : row.unit === "seconds" ? "SEC" : "MMR"}</p>
                  </div>
                  <span className="border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-primary">{row.direction}</span>
                </div>
                <p className="mt-4 text-sm leading-6 text-muted-foreground">
                  95% confidence interval: <span className="font-mono text-foreground">{interval(row.metric)}</span> {row.unit}
                </p>
              </article>
            ))}
          </div>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-2">
          <article className="border border-border bg-card/90 p-5 sm:p-6">
            <div className="flex items-center gap-3 text-primary"><Split className="size-5" /><p className="text-xs font-black uppercase tracking-[0.15em]">Ablation: candidate selection</p></div>
            <h2 className="display-type mt-4 text-2xl">THE QUEUE-QUALITY TRADEOFF STARTS HERE</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Holding snake team balancing fixed, Tail-Aware candidate selection added {signed(candidateSelection.queueSeconds.mean)} seconds, reduced lobby spread by {Math.abs(candidateSelection.spread.mean).toFixed(2)} synthetic MMR, and reduced the default bad-match rate by {Math.abs(candidateSelection.badMatchRate.mean).toFixed(2)} percentage points.
            </p>
          </article>
          <article className="border border-border bg-card/90 p-5 sm:p-6">
            <div className="flex items-center gap-3 text-primary"><Scale className="size-5" /><p className="text-xs font-black uppercase tracking-[0.15em]">Ablation: team balancing</p></div>
            <h2 className="display-type mt-4 text-2xl">BALANCING MOSTLY FIXES TEAM GAP</h2>
            <p className="mt-4 text-sm leading-7 text-muted-foreground">
              Optimized balancing did not change queue time, lobby spread, or the default bad-match rate in this model. It primarily reduced team gap: {Math.abs(baselineBalancing.teamGap.mean).toFixed(2)} synthetic MMR for Baseline and {Math.abs(tailAwareBalancing.teamGap.mean).toFixed(2)} for Tail-Aware.
            </p>
          </article>
        </section>

        <section className="mt-6 grid gap-4 lg:grid-cols-[1.25fr_.75fr]">
          <article className="border border-[#4a3f26] bg-[#201d14]/90 p-5 sm:p-6">
            <div className="flex items-center gap-3 text-[#f3d177]"><ShieldAlert className="size-5" /><p className="text-xs font-black uppercase tracking-[0.15em]">Overnight limitation</p></div>
            <h2 className="display-type mt-4 text-2xl">A SMALL WIN DOES NOT STOP A COLLAPSE</h2>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-muted-foreground">
              Overnight, Tail-Aware lowered the bad-match rate by {Math.abs(overnightBadRate.mean).toFixed(2)} percentage points ({interval(overnightBadRate)}). That result was consistent across the model&apos;s repeated runs, but it was not practically enough: the default rule still flagged {overnightBaselineBadRate.toFixed(2)}% of Baseline lobbies and {overnightTailAwareBadRate.toFixed(2)}% of Tail-Aware lobbies.
            </p>
          </article>
          <aside className="border border-primary/35 bg-primary/10 p-5 sm:p-6">
            <BarChart3 className="size-5 text-primary" />
            <h2 className="mt-4 text-base font-black uppercase tracking-[0.12em]">Threshold check</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              All {report.lateNightBalancedSensitivity.cells.length} predeclared threshold combinations kept a lower synthetic bad-match rate for Tail-Aware plus optimized balancing. The thresholds were not changed after results were known.
            </p>
          </aside>
        </section>

        <section className="mt-6 flex flex-wrap items-center justify-between gap-4 border border-border bg-[#0a151d]/90 px-5 py-5 sm:px-6">
          <div>
            <p className="text-xs font-black uppercase tracking-[0.15em] text-primary">Want to inspect the model?</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">Explore the controls, assumptions, and the reviewable synthetic benchmark artifacts.</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link href="/methodology" className="inline-flex h-10 items-center gap-2 border border-border bg-secondary/30 px-4 text-xs font-black uppercase tracking-[0.1em] hover:border-primary hover:text-primary">Read methodology <ArrowRight className="size-4" /></Link>
            <Link href="/simulator" className="cut-corners inline-flex h-10 items-center gap-2 bg-destructive px-4 text-xs font-black uppercase tracking-[0.1em] text-white hover:bg-[#ff5b68]">Run simulation <ArrowRight className="size-4" /></Link>
          </div>
        </section>
      </div>
    </main>
  );
}
